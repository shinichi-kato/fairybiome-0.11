/*
  bot I/O
 ===============================

  function syncCache(firestore, botId)

  chatbotのデータはgraphql,firestore,dexieの三点で運用する。
  graphql(gq)はソースであり、firestore(fs),dexie(dx)にアップロードして利用する。
  firestoreは主記憶、dexieはそのキャッシュである。

  3者のタイムスタンプを比べ、
  gqが最も新しい → gqの内容をfsとdxにアップロード
  fsが最も新しい → fsの内容をdxにアップロード
  dxが最も新しい → dxの内容をfsにアップロード

  この関数でmainとpartすべてを処理する。

  関数内ではschemeという共通のデータ構造を利用する。
  fsIdはfirestore上でのdocId。
  botIdはユーザ用のBotの場合ユーザidが含まれており、ユーザを
  特定できる。NPCボットの場合はユーザと無関係で全員共通。
  schemeNameは'FairyGirl'のようなディレクトリ名で、そのディレクトリに
  はmainと各part辞書が格納される。moduleNameはファイル名*.jonを
  そのまま使用し、mainにはmain.jsonという名前を使用する。

  scheme = {
    updatedAt,
    botModules: [
      {
        fsId,         // firestore上でのdocId
        data: {
          botId,      // PCbotはユーザにひも付き、NPCbotは紐付かないid
          schemeName, // chatbotの型式、graphqlのDirectory名
          moduleName, // main,各partの名前。graphqlのname
          updatedAt,
          mainFsId,   // mainスクリプトのfsId
        },
        ...

      },
      ...
    ]
  }

*/

import {
  doc,
  collection,
  getDocs,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import {botDxIo} from './BotDxIo';

const RE_NON_INPUT_LINE = /^(#|with|bot|{)/;

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
    console.log(n)
    if (
      !dir.startsWith('_') &&
      !dir.startsWith('NPC') &&
      n.name === 'main'
    ) {
      s[dir] = true;
    }
  });

  const sk = Object.keys(s);
  const i = Math.floor(Math.random() * sk.length);
  return sk[i];
}

/**
 * 起動するbotのbotIdを選定する
 * @param {string} userId userのId
 * @param {string} schemeName 起動を希望するschemeName
 * @param {object} chatbotSnap graphqlのsnap
 * @return {array} botId, targetSchemeName
 */
export async function findDefaultBotId(userId, schemeName, chatbotSnap) {
  // (1)schemeNameが指定されていたらそれを使用し、ユーザのbotで
  // schemeNameに該当するものがindexedDb上に存在していればそれを使う。
  // (2)なければschemeNameのbotを新たに生成して使う。
  // (3)schemeNameが未指定の場合、ユーザのbotが既存であればその中から
  // ランダムに一つを選んで起動する。なければsnapから非NPCの
  // schemeをランダムに一つ選んで起動する

  let botId;
  let targetSchemeName;

  if (schemeName) {
    botId = `${schemeName}${userId}`;
    targetSchemeName = schemeName;
  } else {
    const snap = await botDxIo.findUserDxModule(userId);
    targetSchemeName = snap.botId || randomlyChoosePCScheme(chatbotSnap);
    botId = snap.botId || `${targetSchemeName}${userId}`;
  }

  return [botId, targetSchemeName];
}

/**
 * firestore, indexedDB, graphqlを同期しindexedDBを最新にする
 * @param {Object} firestore firestoreオブジェクト
 * @param {Object} graphqlSnap graphqlで取得したSnap
 * @param {String} schemeName チャットボットの型式(relativeDirectory)
 * @param {String} botId 同期するチャットボットのId
 * @param {String} userId firebaseで取得したuid
 * @return {Array} 動悸したbotを構成するbotModule名のリスト
 */
export async function syncCache(firestore, graphqlSnap, schemeName, botId) {
  // token用タグを読み込み記憶する
  const wordToTag = graphqlToWordTag(graphqlSnap.token);
  await botDxIo.uploadDxWordToTagList(wordToTag);

  // fs,dx,gqの保存されているschemeのタイムスタンプを確認し、
  // dxが最新になるようアップデートする

  const fsScheme = await downloadFsScheme(firestore, botId);
  const dxScheme = await botDxIo.downloadDxScheme(botId);
  const gqScheme = graphqlToScheme(graphqlSnap.chatbot, schemeName, botId);
  const fsud = fsScheme.updatedAt;
  const dxud = dxScheme.updatedAt;
  const gqud = gqScheme.updatedAt;
  console.log(gqScheme);

  if (fsud > dxud && fsud >= gqud) {
    // fsが最新の場合、fs->dxにコピーする
    await botDxIo.uploadDxScheme(fsScheme, botId);
  } else if (dxud > fsud && dxud >= gqud) {
    // dxが最新の場合、dx->fsにコピーする
    await uploadFsScheme(firestore, dxScheme);
  } else {
    if (gqud > fsud) {
      // gqが最新の場合、gq->fsにコピーする
      await uploadFsScheme(firestore, gqScheme);
    }
    if (gqud > dxud) {
      // gqが最新の場合、gq->dxにコピーする
      await botDxIo.uploadDxScheme(gqScheme);
    }
  }

  return botDxIo.getModuleNames(botId);
}

/**
 * firestoreにschemeをアップロード
 * schemeのfsIdが未定義の場合、アップロード後にschemeのfsIdを書き換える
 * @param {Object} firestore firestoreオブジェクト
 * @param {Ojbect} scheme scheme形式のbotデータ
 */
async function uploadFsScheme(firestore, scheme) {
  const batch = writeBatch(firestore);

  // main moduleのscriptは各partでも読み込むため、はじめに
  // mainを探してuploadし、他にfsIdを渡す
  let main;
  for (main of scheme.botModules) {
    if (main.data.moduleName === 'main') {
      let docRef;
      if ('fsId' in main) {
        docRef = doc(firestore, 'botModules', main.fsId);
      } else {
        docRef = doc(collection(firestore, 'botModules'));
        main.fsId = docRef.id;
      }
      batch.set(docRef, main.data);
      break;
    }
  }

  for (const module of scheme.botModules) {
    if (module.data.moduleName !== 'main') {
      let docRef;
      if ('fsId' in module) {
        docRef = doc(firestore, 'botModules', module.fsId);
      } else {
        docRef = doc(collection(firestore, 'botModules'));
        module.fsId = docRef.id;
      }
      batch.set(docRef, {...module.data, mainFsId: main.fsId});
    }
  }
  await batch.commit();
}

/**
 * firestoreからscheme形式でbotIdで指定したデータを取得
 * @param {Object} firestore firestoreオブジェクト
 * @param {String} botId チャットボットのId
 * @return {Object} scheme
 */
async function downloadFsScheme(firestore, botId) {
  const scheme = {
    updatedAt: new Date(0), // main,partsのうち最新のもの
    botModules: [], // 内容は{id,data}
  };

  const botModulesRef = collection(firestore, 'botModules');
  const q = query(botModulesRef, where('botId', '==', botId));
  const snap = await getDocs(q);

  snap.forEach((doc) => {
    const data = doc.data();
    scheme.botModules.push({fsId: doc.id, data: data});
    const ts = data.updatedAt.toDate();
    if (scheme.updatedAt < ts) {
      scheme.updatedAt = ts;
    }
  });

  return scheme;
}

/**
 * graphqlから取得したsnapからschemeNameのデータを抽出
 * @param {Object} gqSnap graphqlのSnap
 * @param {String} schemeName scheme名(relativeDir)
 * @param {String} botId チャットボットのId
 * @return {Object} scheme形式のチャットボットデータ
 */
export function graphqlToScheme(gqSnap, schemeName, botId) {
  // graphql上のデータにはbotIdがないため
  // 外から与える。schemeNameも外から与える。

  const parseScript = (src) => {
    // 簡易的パース
    const script = [];
    for (const line of src) {
      if (line.match(RE_NON_INPUT_LINE)) {
        script.push({text: line});
        continue;
      }
      const v = line.split('\t');
      if (v.length === 2) {
        script.push({text: v[0], timestamp: new Date(Number(v[1]))});
        continue;
      }
      script.push({text: line});
    }
    return script;
  };

  const scheme = {
    updatedAt: new Date(0),
    botModules: [],
  };

  gqSnap.forEach((node) => {
    if (node.relativeDirectory === schemeName) {
      const s = JSON.parse(node.internal.content);
      const u = new Date(s.updatedAt);

      if (scheme.updatedAt < u) {
        scheme.updatedAt = u;
      }
      scheme.botModules.push({
        id: null,
        data: {
          ...s,
          script: parseScript(s.script),
          updatedAt: u,
          moduleName: node.name,
          schemeName: schemeName,
          botId: botId,
        },
      });
    }
  });

  return scheme;
}

/**
 * token用タグをgraphqlのsnapから取得
 * @param {Object} gqSnap graphqlの結果
 * @return {Array} wordToTagのリスト
 */
export function graphqlToWordTag(gqSnap) {
  const valueTagList = [];
  for (const node of gqSnap) {
    for (const token of node.values) {
      const [tag, values] = token.split(' ', 2);
      for (const w of values.split(',')) {
        valueTagList.push({tag: tag, word: w});
      }
    }
  }
  return valueTagList;
}
