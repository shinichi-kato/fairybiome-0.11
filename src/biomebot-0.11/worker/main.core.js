/*
*/

import { db } from '../../dbio.js';

export const main = {
  botId: null,
  schemeName: null,
  avatarDir: null,
  backgroundColor: "#cccccc",
  channel: new BroadcastChannel('biomebot'),

  standby: (botId)=>{
    /*
      botIdかつkind:'main'のデータを読み、
      memoryにBOT_NAMEがなければボットの名前を生成して付与する。
      確率に従い自発的summonを行う。
      summonしない場合、ユーザの召喚を聞き取る
    */
  },

  deploy: ()=>{

  }
}