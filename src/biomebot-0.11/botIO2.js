/*
bot I/O ver2
=============================================

## チャットボットの識別
チャットボットの元データはschemeNameで区別される。同じschemeNameの
チャットボットをユーザは最大1つまで保有できる。会話ログ上などでは
複数のユーザがそれぞれ保有する同schemeNameのチャットボットを識別するため
main.jsonに対してfirestore上で与えられるfsIdをbotIdとする。

また、起動中のチャットボットの種類はusersコレクションに
activeBotIdとして格納される。

チャットボットのデータはgraphql、fs、dxの3つの場所に格納される。

## graphql上での格納形式

[
  modifiedTime,
  settings: {
    schemeName,
    moduleName
  },
  scirpt:[
    # {} タグ記述,
    # 
    # page0
  ]
]

## fs上での格納形式

collection chatbot
└doc [auto fsid] // ←botId
  ├userId=userId,
    schemeName=schemeName,
    index=
│    [module]: {
          setting,
          memory,
          origin,
          page0
        }, 
  │}
  └collection botModules
    └doc `${moduleName}`
      ├settings
      └collection scripts
        ├doc memory // gqのイメージのまま格納
        ├doc origin
        └doc page0

## dx上での格納形式
index "++id, [botId+moduleName]"
  kind=index: 
     {
  │ [schemeName]: {
  │    [module]: {
          fsid, 
          updatedAt: {
            memory, origin page0
          }, 
        }
  │  }
  │}
  kind = cache:
    {updatedAt}

settings: "++id, [botId+moduleName]"
  {settings}

memory "[botId+moduleName+key]"
  [values]

script "++id, [botId+moduleName+page]"
  {lineNumber, text}

cache "++id, [botId+moduleName]"
  matrix,
  outScirpt,
  vocab,
  ...

##  チャットボット起動時に以下の手順でデータのsyncを行う。
###  step1. gq - fs間のsync
gq上のデータではmoduleごとにmodifiedTimeが記載されている。fs側では
script単位になっている。このうちfsのmemoryやpage0はチャットボットが
稼働した直近のmodifiedTimeになるため、gqの書き換えを追い越す可能性が
高い。そのため、fsのoriginを調べてそれよりgqが新しい場合、
すべてのスクリプトを更新する。なおmemoryの内容も上書きするが
{BOT_NAME}のみは更新の対象にしない。

またfsに存在するがgqに存在しないmoduleは削除するが、collectionは
webから直接削除できないため、スクリプトとdocに格納したデータを削除し
docの名前を`${module}_deleted`に変更する。

###  step2. fs - dx間のsync
dxにはfsからデータがコピーされ、dx上で新たに生成するデータは
page0のみである。

fsのindexとdxのindexを比較し、fs上の日付が新しい部分にはdxにそれを
反映させる。dxのほうが新しい部分はfsに反映させる。


### step3. dx - dx cache間のsync
dx上では

## scriptの格納方法
graphql上では、main.jsonにはdataのセクションの内容がそのままの
形式で記載される。またその他のファイルではscriptの内容を
シンプルな配列として保持する。書式は以下の通り。

  script: [
    "# comment", // コメント行
    "{tag} candidates"  // tag行
    "head text", // 入出力行
    "head text (mm/dd hh:mm)", // タイムスタンプ付き入力行
                               // 出力行ではタイムスタンプは無視 
    "# --page0--", // ページ区切り
    "head text",
  ]

スクリプトに含まれるtag行はfs上でscripts/memoryにコピーされ、
その他はscripts/origin, scripts/page0, ...に分割して格納される。
originはgraqhqlに格納されたオリジナルの内容で、
page0以降は学習により獲得した内容である。

なお、repositoryページではmain.jsonはjson形式で、他のmoduleは
txt形式で入出力する。


## memory

fsやdxにおいてscriptに格納されたtag行はmemoryにコピーされる。
memoryは会話の中で新たにタグの候補を獲得したときに、その候補を
追加で保持する。これを書き出す場合にはscriptのタグ行をmemoryの
内容で更新してから書き出す。(タグが増えるわけではない)

## 更新頻度



*/

import {
  doc,
  collection,
  getDocs,
  getDoc, addDoc, limit, setDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { dxIO } from './dxIO';

const RE_TAG_LINE = /^\{[a-zA-Z_]+\} +.+$/;
const RE_BLANK_LINE = /^\s*$/;
const RE_PAGE_LINE = /^# +-+ page [0-9]+ -+/;


/**
 * ユーザのアクティブなチャットボットのbotIdとを取得する。
 * @param {Object} firestore 
 * @param {String} userId 
 * @param {String} schemeName ユーザが起動オプションとして与えたschemeName(省略可)
 * @param {Object} gqSnap graphqlから取得したチャットボットデータ
 * @returns [id, data] チャットボットのbotIdとデータ
 */
export async function findActiveBotId(firestore, userId, schemeName, gqSnap) {
  schemeName ||= "";
  // step 1. ユーザが指定したschemeNameが存在したらそのbotId
  const botsRef = collection(firestore, 'chatbots');
  const q = query(botsRef, where('userId', '==', userId), where('schemeName', '==', schemeName), limit(1));
  const botsSnap = await getDocs(q);
  botsSnap.forEach(doc => {
    return doc.id;
  })

  // step 2. ユーザが前回起動していたチャットボットがあればそのbotId
  const userRef = doc(firestore, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.activeBotId) {
      const botRef = doc(firestore, 'chatbots', data.activeBotId);
      const botSnap = await getDoc(botRef);
      if (botSnap.exists()) {
        return data.activeBotId;
      }
    }
  }

  // step 3. ランダムに非NPC schemeNameを選んでdocを生成し、そのbotIdを返す
  schemeName = randomlyChoosePCScheme(gqSnap);
  const docRef = await addDoc(botsRef, {
    userId: userId,
    schemeName: schemeName,
    index: {},
  });

  // botIdを新しく作ったらusersにも反映
  setDoc(userRef, { activeBotId: docRef.id }, { merge: true });

  return docRef.id;
}



/**
 * userIdで指定されたユーザのアクティブなチャットボットについて、
 * gq,fs,dxのデータを同期する。
 * @param {} gqSnap // graphql経由で取得したbotデータ
 * @param {} fs // firestoreインスタンス
 * @param {} userId 
 */
export async function syncActiveBot(gqSnap, fs, botId, userId, tokenSnap) {
  const botDoc = await getBotDoc(fs, botId);
  const schemeName = botDoc.schemeName;
  const gqModifiedTime = getGqSchemeModifiedTime(gqSnap, schemeName);

  // step 1: gq - fsを比べ、gqのほうが新しいモジュールはfsに書き込む
  // gqは[module]: modifiedTimeの形式で格納
  const gqModData = gqSnap.filter((n) => n.relativeDirectory === schemeName);

  const newFsIndex = {};
  const fsIndex = botDoc.index || {};
  for (const modName in gqModifiedTime) {
    // modがindexにないか、モジュールのoriginが新しかったらすべて上書き
    if (!(modName in fsIndex && fsIndex[modName.origin] < gqModifiedTime[modName])) {
      newFsIndex[modName] = await uploadGqModuleToFs(gqModData, fs, modName, botId);
    }
  }

  // fsにはあるがgqにないmoduleの削除
  deleteUnusedFsModule(fs, botId, fsIndex, gqModifiedTime);

  const docRef = doc(fs, "chatbots", botId);
  //index情報の更新
  await setDoc(docRef, {
    userId: userId,
    schemeName: schemeName,
    index: { ...newFsIndex }
  });

  // step 2: fs - dxを比べ、fsの方が新しいスクリプトはdxに書き込む
  // 両方のタイムスタンプが同じ場合の処理は適切？要検討
  const newDxIndex = {};
  const dxIndex = await dxIO.getIndex(botId);
  for (const modName in newFsIndex) {
    const fsModIndex = fsIndex[modName]
    const modData = await downloadFsModule(fs, botId, modName)
    if (!(modName in dxIndex.index)) {
      await dxIO.uploadModuleToDb(botId, modName, modData);
      newDxIndex[modName] = newFsIndex[modName];
      await dxIO.deleteCache(botId, modName);
    } else {
      for (const page in fsModIndex) {
        // fsのモジュールが新しいスクリプトはDxにコピー
        const fspdate = fsModIndex[page];
        const dxpdate = dxIndex.index[modName][page]
        if (fspdate > dxpdate) {
          await dxIO.uploadModuleToDb(botId, modName, modData, page);

          // cache更新の必要があるため削除
          await dxIO.deleteCache(botId, modName);
        }
        if (fspdate >= dxpdate) {
          if (!(modName in newDxIndex)) {
            newDxIndex[modName] = {};
          }
          newDxIndex[modName][page] = fsModIndex[page];
        }

        if (fsModIndex[page] < dxIndex.index[modName][page]) {
          // dxのモジュールが新しい場合はfsにコピー
          // page0を想定

        }
      }

    }
  }
  await dxIO.deleteUnusedDxModule(botId, dxIndex, newDxIndex);

  // tokenのアップロード
  let tokenModifiedTime = tokenSnap.modifiedTime;
  if (!('tokenModifiedTime' in dxIndex)) {
    await dxIO.writeTokens(tokenSnap.values);

  } else if (dxIndex.tokenModifiedTime < tokenModifiedTime) {
    await dxIO.writeTokens(tokenSnap.values);
    tokenModifiedTime = dxIndex.tokenModifiedTime;
  }

  await dxIO.setIndex(botId, {
    schemeName: schemeName,
    userId: userId,
    index: newDxIndex,
    tokenModifiedTime: tokenModifiedTime
  });

  return Object.keys(newDxIndex);
}



/**
 * userId, botIdで指定されたチャットボットのindex情報を取得
 * 
 */
async function getBotDoc(firestore, botId) {
  const botIndexRef = doc(firestore, 'chatbots', botId);
  const botIndexSnap = await getDoc(botIndexRef);
  if (botIndexSnap.exists()) {
    const data = botIndexSnap.data();
    return data;
  }
  return false;
}

/**
 * fsにgqのmoduleをアップロードする
 * @param {object} gqModData graphqlで取得したチャットボット情報
 * @param {object} fs firestoreインスタンス
 * @param {string} modName モジュール名
 * @param {string} botId チャットボットのbotId
 * @param {string} userId 
 */
async function uploadGqModuleToFs(gqModsData, fs, modName, botId) {

  // gqModDataのスクリプトをmemory, origin, page0に分割。
  // phase0: memoryは{}行の終わりまで、
  // phase1: originはそこから # -- page0 ---直前まで
  // phase2: page0 (page nは保留)

  // gqModDataは全moduleを含む。その中からnameがmodNameに一致するものを探す
  let scripts = [{}, {}, {}, {}, {}];
  let gqModData = {};
  let i = 0;
  for (const mod of gqModsData) {
    if (mod.name === modName) {
      gqModData = JSON.parse(mod.internal.content);
      let block = 1
      for (const line of gqModData.script) {
        if (line.startsWith('#') || line.match(RE_BLANK_LINE)) {
          scripts[block][i++] = line;
          continue
        }
        if (block === 0) {
          if (!line.match(RE_TAG_LINE)) {
            block = 1;
          }
        } else if (block === 1) {
          if (line.match(RE_TAG_LINE)) {
            block = 0;
          }
          else if (line.match(RE_PAGE_LINE)) {
            block = 2;
          }
        }
        scripts[block][i++] = line;
      }
      const index = {}

      const batch = writeBatch(fs);
      const docRef = doc(fs, "chatbots", botId, "botModules", modName);
      if ('settings' in gqModData) {
        batch.set(docRef, {
          settings: gqModData.settings
        });

        index.settings = mod.modifiedTime;
      }

      if (scripts[0].length !== 0) {
        const sr = doc(docRef, "scripts", "memory");
        batch.set(sr, { script: scripts[0] });
        index.memory = mod.modifiedTime;
      }
      if (scripts[1].length !== 0) {
        const sr = doc(docRef, "scripts", "origin");
        batch.set(sr, { script: scripts[1] });
        index.origin = mod.modifiedTime;
      }
      if (scripts[2].length !== 0) {
        const sr = doc(docRef, "scripts", "page0");
        batch.set(sr, { script: scripts[2] });
        index.page0 = mod.modifiedTime;
      }
      await batch.commit();

      return index;
    }
  }
}


/**
 *
 * @param {object} gqSnap graphqlで取得したチャットボット情報
 * @return {string} ランダムに選んだschemeName
 */
function randomlyChoosePCScheme(gqSnap) {
  // gqSnapからrelativeDirectory(=schemeName)を集め、
  // それらの中からNPCで始まるものを除き、
  // 残りからランダムに一つを選んで返す。

  const s = {};
  gqSnap.forEach((n) => {
    const dir = n.relativeDirectory;
    if (!dir.startsWith('_') && !dir.startsWith('NPC') && n.name === 'main') {
      s[dir] = true;
    }
  });

  const sk = Object.keys(s);
  const i = Math.floor(Math.random() * sk.length);
  return sk[i];
}

/**
 * gqSnapからschemeNameで指定されたチャットボットのmodifiedTimeを得る
 * @param {object} gqSnap graphqlで取得したチャットボット情報
 * @param {string} schemeName
 */
function getGqSchemeModifiedTime(gqSnap, schemeName) {
  // schemeNameに該当するmoduleすべてのmodifiedTimeを確認し、
  // [module]: modifiedTime の形式で返す。
  const data = {};
  gqSnap.forEach((n) => {
    if (n.relativeDirectory === schemeName) {
      data[n.name] = n.modifiedTime;
    }
  });
  return data;
}

/**
 * FS上のchatobot削除
 * 
 */
async function deleteUnusedFsModule(fs, botId, fsIndex, gqModifiedTime) {
  for (const mod in fsIndex) {
    if (!(mod in gqModifiedTime)) {
      console.log("deleteFsModule未実装:", mod)
    }
  }
}

/**
 * fs上のmodule一つ分のデータをダウンロード
 */
async function downloadFsModule(fs, botId, moduleName) {
  let data = {};
  const docRef = doc(fs, "chatbots", botId, "botModules", moduleName);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const ds = docSnap.data();
    data[''] = ds.settings;
  }
  const scriptsRef = collection(docRef, "scripts");
  const scriptsSnap = await getDocs(scriptsRef);
  scriptsSnap.forEach(doc => {
    const d = doc.data();
    data[doc.id] = d.script;
  })
  return data;

}