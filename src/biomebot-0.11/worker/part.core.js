import replaceAsync from 'string-replace-async';

import { botDxIo } from '../BotDxIo';
import { Noder } from './noder';
import { retrieve } from './retrieve';
import { dxIO } from '../dxIO';
import * as matrix from './matrix';

const DEFAULT_PARAM = {
  TAILING: 0.6, // 類似度行列で今の行が前の行に影響を受ける割合
  LARNING_FACTOR: 1.0, // origin以外のscript(=学習部分)の重み付け
  CONDITION_WEIGHT: 1.0, // 条件タグの重み付け
  TIMESTAMP_WEIGHT: 0.2, // タイムスタンプの重み付け
  ACTIVATION_THRESHOLD: 0.2, // ACTIVATIONが起きる最小の類似度値
};

const RE_COND_TAG = /\{([+-])([a-zA-Z_][a-zA-Z_0-9]*)\}/g;
const RE_WORD_TAG = /(\{[0-9]+\})\t?(.+)?/; //"{1019}" と "{1031}\tが"
const RE_TAG = /(\{[a-zA-Z_][a-zA-Z_0-9]*\})/;

export const part = {
  botId: null,
  moduleId: null,
  schemeName: null,
  moduleName: null,
  channel: new BroadcastChannel('biomebot'),
  activationLevel: 0,
  source: {},
  latestInput: { avatar: '', text: '', displayName: '' },
  latestOutput: { avatar: '', text: '', displayName: '' },

  deploy: async (action) => {
    const { botId, moduleName, validAvatars } = action;
    // const p = await botDxIo.downloadDxModule(botId, moduleName);
    const p = await dxIO.downloadDxModule(botId, moduleName);
    part.botId = botId;
    // part.moduleId = p.fsId;
    part.schemeName = p.schemeName;
    part.moduleName = moduleName;
    part.validAvatars = validAvatars;
    part.defaultAvatar = await botDxIo.pickTag(
      '{DEFAULT_AVATAR}',
      botId,
      'peace'
    );

    let tailing = Number(await botDxIo.pickTag('{TAILING}', botId, DEFAULT_PARAM.TAILING));
    if (tailing >= 1) {
      console.warn(`tailing値(=${tailing})が以上のため、${DEFAULT_PARAM.TAILING}にしました`)
      tailing = 0.6
    }

    let larningFactor = Number(await botDxIo.pickTag('{LARNING_FACTOR}', botId, DEFAULT_PARAM.LARNING_FACTOR));

    part.calcParams = {
      tailing: tailing,
      larningFactor: larningFactor,
      condWeight: Number(await botDxIo.pickTag('{CONDITION_WEIGHT}', botId, DEFAULT_PARAM.CONDITION_WEIGHT)),
      timeWeight: Number(
        await botDxIo.pickTag('{TIMESTAMP_WEIGHT}', botId, DEFAULT_PARAM.TIMESTAMP_WEIGHT)
      ),
      activationThreshold: Number(await botDxIo.pickTag('{ACTIVATION_THRESHOLD}', botId, DEFAULT_PARAM.ACTIVATION_THRESHOLD)),
    };
    part.noder = new Noder(botId);


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
          // なにもしない
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
      await botDxIo.pickTag('{FORCED_ACTIVATION}', part.botId, 1)
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
      score: retrieved.score * (part.activationLevel + 1),
      index: retrieved.index,
    });
  },

  recieve: async (action) => {
    /*
      {type: input}により発行された環境やユーザからの入力を
      受取り、
      ・返答候補のスコア情報を返す。
      ・activationLevelを{RETINTION}値との積で漸減させる
    */
    // やり取りを辞書化するためinputを保持しておく
    const m = action.message;
    part.latestInput = {
      avatar: 'peace',
      text: part._standardize(m.text),
      displayName: m.displayName,
    };

    // retention
    part.activationLevel *= Number(await botDxIo.pickTag('{RETENTION}', part.botId, 0.3));

    const retr = await retrieve(m, part.source, part.botId, part.noder);

    part.channel.postMessage({
      type: 'propose',
      moduleName: part.moduleName,
      score: retr.score * (part.activationLevel + 1),
      index: retr.index,
      activationLevel: part.activationLevel,
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

    const al = part.activationLevel;
    const th = part.calcParams.activationThreshold;
    if (th <= al) {
      // activationが前回から続いている
      // 会話内容を記憶

      await botDxIo.memorizeLine(
        part.latestOutput,
        part.latestInput,
        part.moduleId
      );
      await botDxIo.touchDxScheme(part.botId, part.moduleName);
    }
    else if (0 <= al && al < th) {
      // 前回までactivationが続いていて、今回で終了
      // 会話内容を記録するが、末尾に{DEACTIVATE}を追加
      part.latestInput.text += "{DEACTIVATE}";
      await botDxIo.memorizeLine(
        part.latestOutput,
        part.latestInput,
        part.moduleId
      );
      await botDxIo.touchDxScheme(part.botId, part.moduleName);

    }
    else if (al > 0) {
      // アクティブでない状態からアクティブに変化
      part.activationLevel = Number(
        await botDxIo.pickTag('{ACTIVATION}', part.botId, 1.2)
      );
    }

    // 入力文字列に含まれるwordタグを記憶
    await part._spotWord(part.latestInput.text);

    const line = part.outScript[action.index];
    // line = [head,text]
    const head = line[0];
    let text = line[1];

    // {DEACTIVATE}
    console.log(text)
    text = text.replace("{DEACTIVATE}", () => {
      part.activationLevel = -1;
      console.log(`${part.moduleName} deactivated`)
      return ""
    });

    // タグ展開
    text = await botDxIo.expand(text, part.botId, part.moduleName);


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

    // システムタグ

    part.channel.postMessage({
      type: 'reply',
      moduleName: part.moduleName,
      text: text,
      avatar: avatar,
    });
  },

  deactivate: () => {
    part.activationLevel = -1;
  },

  _calc_matrix: async () => {
    // scriptをDBから取得。形式は[{test,timestamp}]
    // const script = await botDxIo.downloadDxScript(part.moduleId);
    const script = await dxIO.downloadDxScriptByName(part.botId, part.moduleName);

    const stage1 = matrix.preprocess2(
      script,
      part.validAvatars,
      part.defaultAvatar,
    );
    console.assert(stage1.status === 'ok', part.moduleName, stage1.errors);

    const stage2 = matrix.tee(stage1.script);
    console.assert(stage2.status === 'ok', part.moduleName, stage2.errors);

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
      // featは"{0102}\tを"または"{0102}"
      if (m) {
        let value;
        if (m[2]) {
          value = [node.surface.split(m[2])];
        } else {
          value = [node.surface];
        }
        const key = m[1];
        console.log('spotted', m, key, '=', value);
        await botDxIo.updateTagValue(key, value, part.botId, { overwrite: true });
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
      let m = node.feat.match(RE_WORD_TAG);

      if (m) {
        //  "{0003}\tと" または "{0103}"     
        const key = m[1];
        const suffix = m[2] || "";
        const word = await botDxIo.pickTag(key, part.botId);
        if (word && word !== key) {
          console.log("dispatched", key, "=", word)
          rendered.push(`${word}${suffix}`);
        } else {
          rendered.push(node.surface);
        }
        continue;
      }

      m = node.feat.match(RE_TAG);
      if (m) {
        console.log(m)
        const key = m[1];
        const word = await botDxIo.pickTag(key, part.botId);
        rendered.push(word === key ? node.surface : word);
        continue;
      }
      rendered.push(node.surface);
    }

    return rendered.join('');
  },

  /**
   * 入力文字列を規格化
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
