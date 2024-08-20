import replaceAsync from 'string-replace-async';

import {botDxIo} from '../BotDxIo';
import {Noder} from './noder';
import {retrieve} from './retrieve';
import * as matrix from './matrix';

const RE_COND_TAG = /\{([+-])([a-zA-Z_][a-zA-Z_0-9]*)\}/g;
const RE_WORD_TAG = /\{([0-9]+)\}\t?(.+)?/;

export const part = {
  botId: null,
  moduleId: null,
  schemeName: null,
  moduleName: null,
  channel: new BroadcastChannel('biomebot'),
  activationLevel: 0,
  source: {},
  latestInput: {avatar: '', text: '', displayName: ''},
  latestOutput: {avatar: '', text: '', displayName: ''},

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

    part.latestInput = {
      avatar: 'peace',
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
    part.latestInput = {
      avatar: 'peace',
      text: part._standardize(m.text),
      displayName: m.displayName,
    };
    console.log(part.latestInput);
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
      {type: approve}の発行を受取り、
      ・active状態だったらログを学習する
      ・outScriptを文字列化する
      ・レンダリングの対象となったwordTagを記憶する
      ・in-outのペアを辞書に書き込む
      ・activationを行う
    */

    // active状態が続いていたら会話内容を記録。
    // activationLevelは漸減
    if (part.activationLevel > 0) {
      await botDxIo.memorizeLine(
        part.latestOutput,
        part.latestInput,
        part.moduleId
      );
      await botDxIo.touchDxScheme(part.botId, part.moduleName);

      part.activationLevel *= part.retention;
    } else {
      // アクティベーション
      part.activationLevel = Number(
        await botDxIo.pickTag('{ACTIVATION}', part.botId, 1.2)
      );
    }

    // 入力文字列に含まれるwordタグを記憶
    await part._spotWord(part.latestInput.text);

    const line = part.outScript[action.index];
    // line = [head,text]
    console.log(action.index, line);
    const head = line[0];
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

    text = await part._dispatchWord(text);
    
    const avatar = head !== 'bot' ? head : part.defaultAvatar;

    part.latestOutput = {
      avatar: avatar,
      text: `${text}`,
      displayName: '',
    };

    // ユーザ名を復号化
    text = text.replaceAll('{user}', part.latestInput.displayName);

    part.channel.postMessage({
      type: 'reply',
      moduleName: part.moduleName,
      text: text,
      avatar: avatar,
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
    part.source = {
      moduleName: part.moduleName,
      ...matrix.matrixize(stage2.inScript, part.calcParams, part.noder),
    };
  },

  /**
   *  入力文字列に含まれるwordタグに該当した単語を記憶し、
   * 出力文字列に反映する
   * @param {String} text retrieve()で選んだ返答のindex
   * @return {Array} [head,text]出力
   */
  async _spotWord(text) {
    const inNodes = part.noder.nodify(text);
    for (const node of inNodes) {
      const m = node.feat.match(RE_WORD_TAG);
      if (m) {
        const key = m[1];
        const value = [node.surface.split(m[2])];
        console.log('spotted', key, '=', value);
        await botDxIo.updateTagValue(key, value, part.botId, {overwrite: true});
      }
    }
  },

  /**
   * 出力文字列に含まれるwordタグを記憶しているwordに置き換える
   * @param {String} text 出力テキスト
   * @return {String} wordタグを文字列に戻した出力テキスト
   */
  async _dispatchWord(text) {
    const outNodes = part.noder.nodify(text);
    const rendered = [];

    for (const node of outNodes) {
      const m = node.feat.match(RE_WORD_TAG);
      if (m) {
        const key = m[1];
        const suffix = m[2];
        const word = await botDxIo.pickTag(key, part.botId);
        if (word) {
          rendered.push(`${word}${suffix}`);
        } else {
          rendered.push(node.surface);
        }
      } else {
        rendered.push(node.surface);
      }
    }

    return rendered.join('');
  },

  /**
   * ユーザの入力文字列を規格化
   * @param {String} text 入力文字列
   * @return {String} 規格化した文字列
   */
  _standardize(text) {
    // 末尾が。!?などでなければ「。」を補う
    const RE_END_CHAR = /[、。！？｡!?.,]$/;
    const m = text.match(RE_END_CHAR);
    const result = m ? text : `${text}。`;

    // 末尾の ！！！？などを単純化

    return result;
  },
};
