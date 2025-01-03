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

  ## script
  graphql上ではscriptはschemeの中に記述されるが、firestore上では
  botModules document
    └script collection
        ├origin
        └page0
  という構成とする。originはschemeに格納された内容、page0は
  追記された内容とする。またoriginではschemeのスクリプトを
  そのままコピーするため、memoryになるべき内容も含む。dxから
  fsにコピーされたときにはmemoryとscriptが分離した状態になる

  ## memory

*/

import {
  doc,
  collection,
  getDocs,
  getDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { botDxIo } from './BotDxIo';

// const RE_NON_INPUT_LINE = /^(#|with|bot|{)/;

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
  /*
    初期状態ではgqSchemeだけが存在し、それをfsSchemeにアップロードする。
    アップロード時にfsIdが取得できるためそれをschemeに書き戻し、さらに
    dxにfsId付きでアップロードする。

    gqSchemeが最新だがfsが存在する場合、schemeNameとmoduleNameを
    キーとしてfsIdは温存したままgqSchemeの内容を上書きする。新しい
    moduleには新しいfsIdを付与する。その結果得られたschemeでdxは
    上書きする。

    fsまたはdxが最新の場合、新しい方で古い方を更新する。このときも
    schemNameとmoduleNameをキーとし、fsIdは温存する。
  */
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

  if (fsud < gqud && dxud < gqud) {
    // gqが最新：初期化
    // uploadFsSchemeの 戻り値にfsIdが格納される
    const fss = await uploadFsScheme(firestore, gqScheme, fsScheme);
    await botDxIo.uploadDxScheme(fss, botId);
  } else {
    // gqが最新ではない→fsとdxの間で同期
    if (fsud > dxud) {
      await botDxIo.uploadDxScheme(fsScheme, botId);
    } else if (dxud > fsud) {
      // ↑if (dxud-fsud >86400000) とすれば一日上間隔が開かないと更新されない
      // それによりfsへのアクセス頻度を下げられる

      await uploadFsScheme(firestore, dxScheme, fsScheme);
    }
    // dxud === fsudの場合書き込みしない
  }

  return botDxIo.getModuleNames(botId);
}

/**
 * firestoreにschemeをアップロード
 * schemeのfsIdが未定義の場合、アップロード後にschemeのfsIdを書き換える
 * @param {Object} firestore firestoreオブジェクト
 * @param {Ojbect} scheme scheme形式のbotデータ
 * @param {Object} fsScheme fsに既存のデータ
 */
async function uploadFsScheme(firestore, scheme, fsScheme) {
  /*
    moduleName, schemeNameをキーとして上書きを試みる。
    存在しない場合は新規に作成し、schemeのfsIdを書き換える。

    scheme: {
      updatedAt: date(),
      botModules:[
      {
        fsId:"wj0ud4kve8pB"
        data: {
          botId:"fairyGirlCYiv4PyhJDVxUga3GYL3LQTfv2I3",
          mainFsId: "kNW7SZbz9BemknchRbHY",
          memory: {}
          moduleName :"dream"
          schemeName: "fairyGirl"
          script: 
          [{…}, {…}, {…}, ...] 
          updatedAt:Sat Jun 01 2024 15:04:05 GMT+0900 (日本標準時)
        }
      }
  */


  const batch = writeBatch(firestore);

  const writeScript = (data, docRef) => {
    if ('script' in data) {

      const gqScript = [];
      const origin = [];
      const page0 = [];
      for (let item of data.script) {
        // タイムスタンプを可読形式に変換
        const [text, ts] = item.text.split('\t');
        if (ts) {
          item.text = `${text} (${ts2str(ts)})`;
        }
        if (!('doc' in item)) {
          // 初期のgraphqlから得たデータにはdoc,id情報がないため
          // 補完する
          gqScript.push({ doc: 'origin', text: item.text }); // ,item:item.idを消した
        } else if (item.doc === 'origin') {
          origin.push({ doc: item.doc, text: item.text }); // ,item:item.idを消した
        } else if (item.doc === 'page0') {
          page0.push({ doc: item.doc, text: `${item.head} ${item.text}` }); // ,item:item.idを消した
        }
      }

      if (gqScript.length !== 0) {
        const scriptRef = doc(docRef, 'scripts', 'origin');
        batch.set(scriptRef, { script: gqScript });
      }
      if (origin.length !== 0) {
        const scriptRef = doc(docRef, 'scripts', 'origin');
        batch.set(scriptRef, { script: origin });
      }
      if (page0.length !== 0) {
        const page0Ref = doc(docRef, 'scripts', 'page0');
        batch.set(page0Ref, { script: page0 });
      }
    }
    if ('memory' in data && data.memory) {
      const memoryRef = doc(docRef, 'scripts', 'memory');
      batch.set(memoryRef, data.memory);
    }
  };

  // fsSchemeが空の場合新しくfsIdsを生成する。
  // fsSchemeが存在する場合、同一moduleNameのIdはfsScheme上の
  // fsIdを利用する。
  // mainのfsIdを他のmoduleのmainFsIdとして記憶する。



  if (fsScheme.botModules.length === 0) {
    // fsSchemeが空の場合アップロードしてfsIdを書き戻す
    // 最初にmainを書き込む
    let main;
    for (main of scheme.botModules) {
      if (main.data.moduleName === 'main') {
        const docRef = doc(collection(firestore, 'botModules'));
        main.fsId = docRef.id;
        batch.set(docRef, {
          ...main.data,
          script: 'on scirpts/origin',
          memory: 'on scripts/memory',
        });
        writeScript(main.data, docRef);
        break;
      }
    }
    for (const module of scheme.botModules) {
      if (module.data.moduleName !== 'main') {
        const docRef = doc(collection(firestore, 'botModules'));
        module.fsId = docRef.id;
        batch.set(docRef, {
          ...module.data,
          memory: 'on scripts/memory',
          script: 'on scripts/origin',
          mainFsId: main.fsId,
        });
        writeScript(module.data, docRef);
      }
    }
  } else {
    // fsSchemeが空でない場合、ModuleNameをキーに上書き。
    const moduleNameToFsId = getModuleNameToFsId(fsScheme);
    const mainFsId = moduleNameToFsId["main"];

    for (const module of scheme.botModules) {
      const modName = module.data.moduleName;
      let fsId = moduleNameToFsId[modName];
      if (!fsId) {
        console.log(`new botModule on firestore generated for ${modName}`);
      }
      const docRef = fsId ?
        doc(firestore, 'botModules', fsId)
        : doc(collection(firestore, 'botModules'));
      module.fsId = fsId;
      batch.set(docRef, {
        ...module.data,
        memory: 'on scripts/memory',
        script: 'on scripts/origin',
        mainFsId: mainFsId
      });
      writeScript(module.data, docRef);

      delete moduleNameToFsId[modName]

    }
    // schemeに存在しないbotModule が残っていたら削除
    for (const remained of Object.keys(moduleNameToFsId)) {
      console.warn(`${remained}をfirestoreから削除します`)
      batch.delete(doc(firestore, 'botModules', remained));
    }

  }
  await batch.commit();

  return scheme
}

function getModuleNameToFsId(fsScheme) {
  const map = {};
  for (const module of fsScheme.botModules) {
    map[module.data.moduleName] = module.fsId
  }
  return map;
}

/**
 * firestoreからscheme形式でbotIdで指定したデータを取得
 * @param {Object} firestore firestoreオブジェクト
 * @param {String} botId チャットボットのId
 * @return {Object} scheme
 */
export async function downloadFsScheme(firestore, botId) {
  const scheme = {
    updatedAt: new Date(0), // main,partsのうち最新のもの
    botModules: [], // 内容は{id,data}
  };

  const botModulesRef = collection(firestore, 'botModules');
  const q = query(botModulesRef, where('botId', '==', botId));
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data();
    const scriptRef = doc(botModulesRef, d.id, 'scripts', 'origin');
    const page0Ref = doc(botModulesRef, d.id, 'scripts', 'page0');
    const memoryRef = doc(botModulesRef, d.id, 'scripts', 'memory');
    const sq = await getDoc(scriptRef);
    const pq = await getDoc(page0Ref);
    let scripts = sq.data() || { script: [] };
    if (pq.exists()) {
      const ps = pq.data();
      scripts.script = scripts.script.concat(ps.script);
    }

    const mq = await getDoc(memoryRef);

    scheme.botModules.push({
      fsId: d.id,
      data: {
        ...data,
        ...scripts,
        memory: mq.exists() ? mq.data() : {},
      },
    });
    if (toString.call(data.updatedAt) !== '[object Date]') {
      data.updatedAt = new Date(data.updatedAt.seconds * 1000);
    }
    if (scheme.updatedAt < data.updatedAt) {
      scheme.updatedAt = data.updatedAt;
    }
  }
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
      script.push({ text: line, doc: 'origin' });
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
      s.updatedAt = new Date(node.modifiedTime);

      if (scheme.updatedAt < s.updatedAt) {
        scheme.updatedAt = s.updatedAt;
      }
      scheme.botModules.push({
        fsId: null,
        data: {
          ...s,
          script: parseScript(s.script),
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
    // 取れてないtokenファイルがある
    for (const token of node.values) {
      const pos = token.indexOf(" ");
      const tag = token.slice(0, pos);
      const values = token.slice(pos + 1);
      for (const w of values.split(',')) {
        valueTagList.push({ tag: tag, word: w.trim() });
      }
    }
  }
  return valueTagList;
}

/**
 * Date()で生成されるタイムスタンプをmm/dd hh:mm形式に変換
 * @param {ts} ts タイムスタンプ
 */
function ts2str(ts) {
  const d = new Date(Number(ts));
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
}