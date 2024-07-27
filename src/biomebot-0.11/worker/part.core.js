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
  activationLevel: 0,

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
    part.retention = Number(botDxIo.readTag('{RETENTION}', botId, 0.8));

    await part.noder.loadTags();

    part._calc_matrix();

    part.channel.onmessage = (event) => {
      const action = event.data;
      if (action.moduleName === part.moduleName) {
        console.log(part.moduleName, "get ", action);
        switch (action.type) {
          case 'start': {
            part.start(action).then();
            return;
          }

          case 'engage': {
            part.render(action).then();
            return;
          }
        }
      }

      switch (action.type) {
        case 'input': {
          part.recieve(action).then();
          return;
        }
        case 'engage': {
          // engageを受け取ったが自分ではない
          part.deactivate();
          return;
        }
      }
    };

    return true;
  },

  start: async (action) => {
    /* {!on_start}を返答候補にする。これは辞書中で

      cue {!on_start}\ttimestamp
      bot こんにちは！{+on_start}

      のように表す。開始時には{on_start}は記憶されて
      いないため{!on_start}は一致したとみなされ、
      発言が行われることで{on_start}が記憶されて、
      以降この{!on_start}はセッション中採用されにくくなる
    */
    // このパートをactivateする。
    part.activationLevel = Number(
      botDxIo.readTag('{FORCED_ACTIVATION}', part.botId, 2)
    );
    const retrieved = await retrieve(
      {
        text: '{!on_start}',
        timestamp: new Date(),
      },
      part.source,
      part.botId,
      part.noder
    );

    part.channel.postMessage({
      type: 'propose',
      moduleName: part.moduleName,
      score: retrieved.score * part.activationLevel,
      index: retrieved.index,
    });
  },

  recieve: async (action) => {
    /*
      {type: input}により発行された環境やユーザからの入力を
      受取り、
      ・返答候補のスコア情報を返す。
    */
    const retr = await retrieve(
      action.message,
      part.source,
      part.botId,
      part.noder
    );
    part.channel.postMessage({
      type: 'propose',
      moduleName: part.moduleName,
      score: retr.score,
      index: retr.index,
    });
  },

  render: async (action) => {
    /*
      {type: engage}の発行を受取り、
      ・outScriptを文字列化する
      ・レンダリングの対象となったwordTagを記憶する
      ・in-outのペアを辞書に書き込む
      ・activationを行う
    */
    part.activationLevel = Number(
      botDxIo.readTag('{ACTIVATION}', part.botId, 1.2)
    );
    part.channel.postMessage({
      type: 'reply',
      text: '',
      avatar: '',
    });
  },

  deactivate: () => {
    part.activationLevel *= part.retention;
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
