import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {botDxIo} from '../BotDxIo';
import {Noder} from '../worker/noder';
import systemTag from '../../../static/chatbot/token/system.json';
import personTag from '../../../static/chatbot/token/person.json';
import scriptJson from '../../../static/chatbot/botModules/fairyGirl/main.json';
import foodScript from '../../../static/chatbot/botModules/fairyGirl/food.json';
import {graphqlToWordTag} from '../botio';
import {preprocess,tee} from '../worker/matrix';

describe('Noder&matrix', () => {
  const botId = 'user00Test01';

  it('fakeSystemTag', async () => {
    const wordToTag = graphqlToWordTag({
      data: {
        allJson: {
          nodes: [systemTag, personTag],
        },
      },
    });
    botDxIo.uploadDxWordToTagList(wordToTag);
    expect(1).toBe(1);
  });

  it('uploadDxScheme', async () => {
    await botDxIo.uploadDxScheme({
      botModules: [
        {
          fsId: 'fakeFsId',
          data: {
            ...scriptJson,
            script: [...scriptJson.script, '{BOT_NAME} しずく'],
            botId: botId,
            moduleName: 'main',
          },
        },
        {
          fsId: 'fakeFsId2',
          data: {
            ...foodScript,
            botId: botId,
            moduleName: 'food',
          },
        },
      ],
    });

    expect(1).toBe(1);
  });

  it('Noder', async () => {
    const noder = new Noder(botId);
    await noder.loadTags();
    console.log('wordToTags', noder.wordToTags);

    expect(noder.wordToTags.length).toBe(110);
    expect(noder.nameToTags.length).toBe(1);

    const nodes = noder.nodify('こんにちは。しずくです。お父さんは強力です');
    console.log(nodes);

    expect(nodes[4].feat).toBe('{BOT_NAME}');
  });

  // matrix
  // preprocess
  let script = [];
  it('downloadDxScript', async () => {
    script = await botDxIo.downloadDxScript('fakeFsId2');
    expect(script.length).toBe(11);
  });

  it('matrix-preprocess', () => {
    const validAvatars = [
      'peace',
      'absent',
      'cheer',
      'down',
      'sleep',
      'sleepy',
      'waving',
    ];
    const script2 = preprocess(
      script,
      ['peace', ...validAvatars],
      'peace'
    );
    const script3 = tee(script2.script);
    expect(script3.status).toBe('ok');
  });
});
