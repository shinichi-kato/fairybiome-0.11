/* 
  firestore I/O
  ===============================
  firestore上のデータへの低レベルI/Oを提供する。
  以下はfirestore上でのコレクション構成である

  users コレクション
    └user ドキュメント                uid { backgroundColor, avatarDir}
        └ privateLogs コレクション
               └ message ドキュメント {timestamp, message}

  botModules コレクション
    ├ main ドキュメント docId { botId, schemeName, moduleName, ...設定 }
    └ part ドキュメント docId { botId, schemeName, moduleName, script }

    publicLogs コレクション
    └message ドキュメント {timestamp ,message}
  
  userドキュメントにはユーザのfirebaseId,backgroundColor, avatarDirを格納する。
  chatbotsコレクションにはユーザの所有するチャットボットやNPCチャットボットの
  main, partデータを格納する。

  ## userドキュメント
  
  ## botModulesドキュメント
  botId {
    type: 'main',
    schemeName: "",
    uid: '',
    updatedAt: null,
    ...

  }
  
*/