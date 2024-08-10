import replaceAsync from 'string-replace-async';

import {botDxIo} from '../BotDxIo';
import {Noder} from './noder';
import {retrieve} from './retrieve';
import * as matrix from './matrix';

const RE_COND_TAG = /\{([+-])([a-zA-Z_][a-zA-Z_0-9]*)\}/g;

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
    part.defaultAvatar = await botDxIo.pickTag(
      '{DEFALUT_AVATAR}',
      botId,
      'peace'
    );
    part.calcParams = {
      tailing: Number(await botDxIo.pickTag('{TAILING}', botId, 0.6)),
      condWeight: Number(await botDxIo.pickTag('{CONDITION_WEIGHT}', botId, 1)),
      timeWeight: Number(
        await botDxIo.pickTag('{TIMESTAMP_WEIGHT}', botId, 0.2)
      ),
    };
    part.noder = new Noder(botId);
    part.retention = Number(await botDxIo.pickTag('{RETENTION}', botId, 0.8));

    await part.noder.loadTags();

    part._calc_matrix();

    part.channel.onmessage = (event) => {
      const action = event.data;
      if (action.moduleName === part.moduleName) {
        console.log(part.moduleName, 'get ', action);
        switch (action.type) {
          case 'start': {
            // このパートをstart
            part.start(action).then();
            return;
          }

          case 'approve': {
            // このパートでrender
            part.render(action).then();
            return;
          }
        }
      }

      switch (action.type) {
        case 'input': {
          // inputはすべてのpartが受け取る
          part.recieve(action).then();
          return;
        }
        case 'approve': {
          // engageを受け取ったが自分ではない
          part.deactivate();
          return;
        }
        case 'kill': {
          part.channel.close();
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
      await botDxIo.pickTag('{FORCED_ACTIVATION}', part.botId, 2)
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

    part.currentInput = {
      text: '',
      displayName: action.user.displayName,
    };

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
    // やり取りを辞書化するためinputを保持しておく
    const m = action.message;
    part.currentInput = {
      text: m.text,
      displayName: m.displayName,
    };

    const retr = await retrieve(m, part.source, part.botId, part.noder);

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
      await botDxIo.pickTag('{ACTIVATION}', part.botId, 1.2)
    );

    const line = part.outScript[action.index];
    // line = [head,text]
    let text = await botDxIo.expand(line[1], part.botId, part.moduleName);

    // 条件タグの書き込み
    text = await replaceAsync(text, RE_COND_TAG, async (m, mode, tag) => {
      if (mode === '+') {
        await botDxIo.writeTag(`{${tag}}`, 'True', part.botId, part.moduleName);
      } else if (mode === '-') {
        await botDxIo.deleteTag(tag, part.botId, part.moduleName);
      }
      return '';
    });

    // ユーザ名を復号化
    console.log(part.currentInput);
    text = text.replaceAll('{user}', part.currentInput.displayName);

    const avatar = line[0] !== 'bot' ? line[0] : part.defaultAvatar;
    part.channel.postMessage({
      type: 'reply',
      moduleName: part.moduleName,
      text: text,
      avatar: avatar,
    });

    // 採用されたcurrentInputとreplyの組を辞書に書き込む
    // 暫定的にpage0のみ
    // {user}と{bot}を入れ替える？
    // ここからコーディング
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
