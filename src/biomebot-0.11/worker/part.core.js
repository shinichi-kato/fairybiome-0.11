import {botDxIo} from '../BotDxIo';
import {Noder} from './noder';
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
    part.moduleId = p.moduleId;
    part.schemeName = p.schemeName;
    part.moduleName = p.moduleName;
    part.validAvatars = validAvatars;
    part.defaultAvatar = botDxIo.readTag('{DEFALUT_AVATAR}', botId, 'peace');
    part.calcParams = {
      tailing: Number(botDxIo.readTag('{TAILING}', botId, 0.6)),
      condWeight: Number(botDxIo.readTag('{CONDITION_WEIGHT}', botId, 1)),
      tsWeight: Number(botDxIo.readTag('{TIMESTAMP_WEIGHT', botId, 0.2)),
    };
    part.noder = new Noder(botId);

    await part.noder.loadTags();

    part.matrix = await part._calc_matrix();
  },

  run: async (action) => {
    console.log(action);
  },

  _calc_matrix: async () => {
    // scriptをDBから取得。形式は[{test,timestamp}]
    const script = botDxIo.downloadDxScript(part.moduleId);
    const stage1 = matrix.preprocess(
      script,
      part.validAvatars,
      part.defaultAvatar
    );
    console.assert(stage1.status === 'ok', stage1.errors);

    const stage2 = matrix.tee(stage1.script);
    console.assert(stage2.status === 'ok', stage2.errors);

    const stage3 = matrix.matrixize(
      stage2.inScript,
      part.calcParams,
      part.noder
    );
    console.assert(stage3.status === 'ok', stage3.errors);

    return stage3;
  },
};
