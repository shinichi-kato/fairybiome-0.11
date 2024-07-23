import {botDxIo} from '../BotDxIo';
import {Noder} from './noder';
import {retrieve} from './retrieve';
import * as matrix from './matrix';

export const part = {
  botId: null,
  moduleId: null,
  schemeName: null,
  moduleName: null,
  channel: new BroadcastChannel('biomebot'),

  deploy: async (action) => {
    const {botId, moduleName, validAvatars} = action;
    const p = await botDxIo.downloadDxModule(botId, moduleName);
    part.botId = botId;
    part.moduleId = p.fsId;
    part.schemeName = p.data.schemeName;
    part.moduleName = p.data.moduleName;
    part.validAvatars = validAvatars;
    part.defaultAvatar = botDxIo.readTag('{DEFALUT_AVATAR}', botId, 'peace');
    part.calcParams = {
      tailing: Number(botDxIo.readTag('{TAILING}', botId, 0.6)),
      condWeight: Number(botDxIo.readTag('{CONDITION_WEIGHT}', botId, 1)),
      timeWeight: Number(botDxIo.readTag('{TIMESTAMP_WEIGHT}', botId, 0.2)),
    };
    part.noder = new Noder(botId);

    await part.noder.loadTags();

    part._calc_matrix();

    return true;
  },

  recieve: async (action) => {
    /*
      {type: input}により発行された環境やユーザからの入力を
      受取り、
      ・入力テキストを記憶する。
      ・返答候補のスコア情報を返す。
    */
    part.prevInput = action.message.toObject();

    return await retrieve(
      part.prevInput,
      part.source,
      part.botId,
      part.noder
    );
  },

  render: async (action) => {
    /*
      {type: engage}の発行を受取り、
      ・outScriptを文字列化する
      ・レンダリングの対象となったwordTagを記憶する
      ・in-outのペアを辞書に書き込む
    */
  },


  _calc_matrix: async () => {
    // scriptをDBから取得。形式は[{test,timestamp}]
    const script = await botDxIo.downloadDxScript(part.moduleId);
    const stage1 = matrix.preprocess(
      script,
      part.validAvatars,
      part.defaultAvatar
    );
    console.assert(stage1.status === 'ok', stage1.errors);

    const stage2 = matrix.tee(stage1.script);
    console.assert(stage2.status === 'ok', stage2.errors);

    part.outScript = stage2.outScript;
    part.source = matrix.matrixize(
      stage2.inScript,
      part.calcParams,
      part.noder
    );
  },
};
