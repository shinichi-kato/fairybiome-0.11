/* 
  bot I/O
 ===============================
  
  function syncCache(firestore, botId)

  chatbotのデータはgraphql,firestore,dexieの三点で運用する。
  graphql(gq)はソースであり、firestore(fs),dexie(dx)にアップロードして利用する。
  firestoreは主記憶、dexieはそのキャッシュである。

  3者のタイムスタンプを比べ、
  gqが最も新しい　→ gqの内容をfsとdxにアップロード
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
        fsId,　　// firestore上でのdocId
        data: {
          botId,      // PCbotはユーザにひも付き、NPCbotは紐付かないid 
          schemeName, // chatbotの型式、graphqlのDirectory名
          moduleName, // main,各partの名前。graphqlのname
          updatedAt
        },
        ...

      },
      ...
    ]
  }
    
*/

import { doc, collection, getDocs, writeBatch} from 'firebase/firestore';
import { db } from '../dbio';

export async function syncCache(firestore, graphqlSnap, schemeName, botId, userId) {
  // fs,dx,gqの保存されているschemeのタイムスタンプを確認し、
  // dxが最新になるようアップデートする

  const fsScheme = await downloadFsScheme(firestore, botId);
  const dxScheme = await downloadDxScheme(userId, botId)
  const gqScheme = graphqlToScheme(graphqlSnap, schemeName,botId);
  
  const fsud = fsScheme.updatedAt;
  const dxud = dxScheme.updatedAt;
  const gqud = gqScheme.updatedAt;

  if(fsud>dxud && fsud>gqud){
    // fsが最新の場合、fs->dxにコピーする
    await uploadDxScheme(fsScheme, botId);
  } 
  else 
  if(dxud>fsud && dxud>gqud){
    // dxが最新の場合、dx->fsにコピーする
    await uploadFsScheme(firestore, dxScheme);
  } else
  if(gqud>fsud && gqud>dxud){
    // gqが最新の場合、gq->fs, gq->dxにコピーする
    await uploadFsScheme(firestore,gqScheme);
    await uploadDxScheme(gqScheme);
  }

  return await getModuleNames(botId);

}

async function getModuleNames(botId){
  const snaps = await db.botModules
  .where("data.botId")
  .equals(botId)
  .toArray();

  let mods = [];
  for(let snap of snaps){
    mods.push(snap.moduleName);
  }

  return mods;
}

async function uploadFsScheme(firestore, scheme) {
  // schemeをfirestoreにアップロードする。
  // schemeのfsIdが未定義の場合、アップロード後にschemeのfsIdを書き換える

  const batch = writeBatch(firestore);

  for (module of scheme.botModules) {
    let docRef;
    if ('fsId' in module) {
      docRef = doc(firestore, "botModules", module.fsId);
    } else {
      docRef = firestore.collection("botModules").doc();
      module.fsId = docRef.id;
    }
    batch.set(docRef, module.data);

  }
  await batch.commit();


}

async function downloadFsScheme(firestore, botId) {
  let scheme = {
    updatedAt: new Date(0), // main,partsのうち最新のもの
    botModules: [] // 内容は{id,data}
  };

  const botModulesRef = collection(firestore, "botModules");
  const q = query(botModulesRef, where("botId", "==", botId));
  const snap = await getDocs(q);


  snap.forEach(doc => {
    scheme.botModules.push({ fsId: doc.id, data: doc.data() });
    const ts = doc.updatedAt.toDate();
    if (scheme.updatedAt < ts) {
      scheme.updatedAt = ts
    }
  });

  return scheme

}

async function uploadDxScheme(scheme){
  for(let module of scheme.botModules){
    await db.botModules.put({
      ...module
    })
  }
}

async function downloadDxScheme(botId) {
  let scheme = {
    updatedAt: new Date(0), // main,partsのうち最新のもの
    botModules: [] // 内容は{id,data}
  };

  const snaps = await db.botModules
    .where("data.botId")
    .equals(botId)
    .toArray();

  for(let snap in snaps){
    scheme.botModules.push(snap);
    const ts = snap.data.updatedAt;
    if (scheme.updatedAt < ts){
      scheme.updatedAt = ts;
    }
  }

  return scheme;
} 

function graphqlToScheme(gqSnap,schemeName,botId){
  // graphql上のデータにはbotIdがないため
  // 外から与える。schemeNameも外から与える。
  scheme={
    updatedAt: new Date(0),
    botModules:[]
  };

  gqSnap.allJson.nodes.forEach(node=>{
    if(node.parent.relativeDirectory === schemeName){
      let s = JSON.parse(node.parent.internal.content);
      if(scheme.updatedAt>s.updatedAt){
        scheme.updatedAt = s.updatedAt
      }
      botModules.push({id:null,data:{
        ...s,
        schemeName: schemeName,
        botId: botId,
      }});
    }

  });

  return scheme;
}