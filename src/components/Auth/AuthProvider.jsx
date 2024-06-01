/*
AuthProvider

  Authの管理では、firebaseのauth(a)、サインインで取得できるユーザ情報(u)、
  dexie上に記憶したユーザ設定(p)の3つの情報を操作する。

  authState               a  u  p   状態                      handler 
  ----------------------------------------------------------------------------
  init                    -- -- --  初期状態                   
  disconnected            NG -- --  firebase接続に失敗した
  connected               G  -- --  firebaseに接続した
  ↓
  SignDialog:open          G  NG --  サインアウト状態          authStateChange
  signedIn                G  G  --  サインインに成功した      authStateChange
  SignDialog:waiting                     処理まち
  ↓
  UserSettingsDialog:open  G  G  NG  ユーザ設定が存在しない    userPropChange
  waitingSetting                    処理まち
  ready                   G  G  G   a,u,pが揃っている         userPropChange
  ----------------------------------------------------------------------------
  
  user: {
    email
  }

  上記に加え、追加で下記のデータをfirestoreでユーザごとに管理する
  userProps: {
    displayName,
    backgroundColor,
    avatarDir,
  }

*/

import React, { useEffect, useReducer, useRef, createContext } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  getAuth, signOut
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import Landing from '../Landing';
import SignDialog from './SignDialog';
import UserSettingsDialog from './UserSettingsDialog';

export const AuthContext = createContext();

const MESSAGE_MAP = {
  'disconnected': 'firebaseに接続できませんでした',
  'configuration-not-found': 'firebaseのmail/password認証を有効にしてください',
  'invalid-login-credentials': 'ユーザが登録されていません',
  'email-already-in-use': 'ユーザは登録済みです',
  'Missing or insufficient permissions': 'firestoreのルールを読み書き可能に変更してください',
};

const initialState = {
  auth: undefined,
  user: undefined,
  userProps: {backgroundColor: '#cccccc',avatarDir: ""},
  authState: 'init',
  error: undefined,
};

function reducer(state, action) {
  console.log("authProvider",action,state.error)
  switch (action.type) {
    case 'connect': {
      const a = action.auth;
      if (a) {
        return {
          ...initialState,
          auth: a,
          authState: 'connected',
        }
      } else {
        return {
          ...initialState,
          auth: false,
          authState: 'disconnected',
          error: MESSAGE_MAP['disconnected'],
        }
      }
    }

    case 'authStateChange': {
      const u = action.user;
      if (u) {
        return {
          ...state,
          user: u,
          authState: 'signedIn',
          error: null
        }
      } else {
        return {
          ...state,
          user: false,
          authState: 'SignDialog:open',
        }
      }
    }

    case 'userPropsChange': {
      const p = action.userProps;
      if (p) {
        return {
          ...state,
          userProps: p,
          authState: 'ready',
          error: null,
        }
      } else {
        return {
          ...state,
          userProps: {...initialState.userProps},
          authState: 'UserSettingsDialog:open',
        }
      }
    }

    case 'SignDialog:open': {
      return {
        ...state,
        authState: 'SignDialog:open',
        error: null,
      }
    }
    
    case 'SignDialog:waiting': {
      return {
        ...state,
        authState: 'SignDialog:waiting'
      }
    }

    case 'UserSettingsDialog:open': {
      return {
        ...state,
        authState: 'UserSettingsDialog:open',
        error: null,
      }
    }

    case 'UserSettingsDialog:waiting': {
      return {
        ...state,
        authState: 'UserSettingsDialog:waiting'
      }
    }

    case 'UserSettingsDialog:updated': {
      return {
        ...state,
        userProps: action.userProps,
        authState: 'UserSettingsDialog:updated',
        error: null,
      }
    }

    case 'error': {
      return {
        ...state,
        error: MESSAGE_MAP[action.errorCode] || action.errorCode,
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function AuthProvider({ firebase, firestore, children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubscribeRef = useRef();
  const uid = state.user?.uid;

  // -----------------------------------
  // 初期化
  //

  useEffect(() => {
    if (firebase) {
      const auth = getAuth(firebase);
      dispatch({
        type: "connect",
        auth: auth
      });

      unsubscribeRef.current = onAuthStateChanged(auth, (user) => {
        console.log("onauthStateChanged",user)
        dispatch({
          type: 'authStateChange',
          user: user
        });
      });
    }

    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); }
    }



  }, [firebase]);

  // ----------------------------------------------------------
  //  ユーザ追加情報の購読
  //  backgroundColor, avatarDirはユーザ設定情報はfirestoreに格納しており、
  //  ここで最新情報を取得する。

  useEffect(() => {
    let unsubscribe = null;
    if(uid){
      const docRef=doc(firestore, "users", uid);
      unsubscribe = onSnapshot(docRef,snap=>{
        if(snap.exists()){
          const data = snap.data();
          if(data.backgroundColor!==state.userProps.backgroundColor || data.avatarDir!==state.userProps.avatarDir){
            dispatch({
              type: 'userPropsChange',
              userProps: data 
            })
    
          }
        }
      },error => {
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      })
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  }, [uid, firestore, state.user, state.userProps]);

  // -----------------------------------------------------------
  //
  // ユーザ新規作成
  // emailとpasswordを用い、作成が失敗した(emailが登録済み、
  // パスワードが短すぎる等)の場合入力し直しを促す
  //

  function handleSignUp(email, password) {
    dispatch({ type: 'SignDialog:waiting' });
    createUserWithEmailAndPassword(state.auth, email, password)
      // 成功した場合はonAuthStateChangedがトリガされる
      .then()
      .catch((error) => {
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      });
  }

  // -----------------------------------------------------------
  //
  // ログイン
  // emailとpasswordを用いてログインを試みる
  //

  function handleSignIn(email, password) {
    // dispatch({ type: 'SignDialog:waiting' });
    signInWithEmailAndPassword(state.auth, email, password)
      .then(userCredential => {
        console.log(userCredential)
        dispatch({
          type: 'authStateChange',
          user: userCredential.user
        });
      })
      // 成功した場合はonAuthStateChangedがトリガされる
      .catch((error) => {
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      });
  }

  // -----------------------------------------------------------
  //
  // サインアウト
  //

  function handleSignOut() {
    dispatch({ type: 'SignDialog:waiting' });
    signOut(state.auth);
    // onAuthStateChangeがトリガされる
  }

  // -----------------------------------------------------------
  //
  //  ユーザ情報の更新
  //  
  // 基本のユーザ情報(displayName)はauthを利用し、
  // 追加のユーザ情報(avatarDir, backgroundColor)はfirestoreに格納する。
  // firestoreのコレクション構成は以下の通り。
  //
  // users コレクション
  // └user ドキュメント                 { id, backgroundColor, avatarDir}
  //    └ privateLogs コレクション
  //           └ message ドキュメント {timestamp, message}

  function handleChangeUserSettings(data) {
    dispatch({ type: 'UserSettingsDialog:waiting' });

    updateProfile(state.auth.currentUser, { displayName: data.displayName })
      .then(() => {
        const docRef = doc(firestore, "users", uid);
        setDoc(docRef, {
          backgroundColor: data.backgroundColor,
          avatarDir: data.avatarDir,
        })
          .then(() => { 
            dispatch({})
            // listernerでstateが書き換えられる
          })
          .catch(error => {
            dispatch({ type: 'error', errorCode: error.message })
          });

      })
      .catch(error => {
        dispatch({ type: 'error', errorCode: error.message })
      })

  }

  const as = state.authState;
  return (
    <AuthContext.Provider
      value={{
        userProps: state.userProps,
        uid: state.user?.uid,
        handleSignOut: handleSignOut
      }}
    >
      {
        as === 'ready' ? children :
          as.startsWith('SignDialog') ?
            <SignDialog
              authState={state}
              handleSignOut={handleSignOut}
              handleSignUp={handleSignUp}
              handleSignIn={handleSignIn}
            /> :
            as.startsWith('UserSettingsDialog')?
              <UserSettingsDialog
                authState={state}
                handleSignOut={handleSignOut}
                handleChangeUserSettings={handleChangeUserSettings}
              /> :
              <Landing
                authState={state}
              />
      }
    </AuthContext.Provider>
  )
}