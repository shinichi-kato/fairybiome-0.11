import {botDxIo} from '../BotDxIo';

export const part = {
  botId: null,
  moduleId: null,
  schemeName: null,
  moduleName: null,
  channel: new BroadcastChannel('biomebot'),

  deploy: async (action) => {
    const {botId, moduleName} = action;
    const p = await botDxIo.downloadDxModule(botId, moduleName);
    part.botId = botId;
    part.moduleId = p.moduleId;
    part.schemeName = p.schemeName;
    part.moduleName = p.moduleName;

    return true;
  },

  run: async (action) => {
    console.log(action);
  },

  _calc_matrix: () => {
    // scriptをDBから取得。形式は[{test,timestamp}]
    const scirpt = botDxIo.downloadDxScript(part.moduleId);
  },
};
