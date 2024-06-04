import {botDxIo} from '../BotDxIo';

export const part = {
  botId: null,
  schemeName: null,
  channel: new BroadcastChannel('biomebot'),

  deploy: async (action) => {
    const {botId, moduleName} = action;
    const p = await botDxIo.downloadDxModule(botId, moduleName);
    part.botId = botId;
    part.schemeName = p.schemeName;
    part.moduleName = p.moduleName;
    return true;
  },

  run: async (action) => {
    console.log(action);
  },
};
