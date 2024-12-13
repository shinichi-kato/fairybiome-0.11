/*
bot script lint

# main.json
* avatarDirがvalidか
* 必要なシステムタグが定義されているか

# その他.json
* validなavatarが使われているか
* ブロックの末尾がbotで終わっているか
* undefinedなタグが使われていないか
* 
*/

import { describe, it, assert } from 'vitest';
import fs from 'fs';
import path from 'path';

const usageMessage = `
チャットボットスクリプトのテスト
====================================
使用法
$ target=[moduleName] npm run bot-test

`;

const RE_TAG_LINE = /^\{[a-zA-Z_]+\} +.+$/;
const RE_WITH_LINE = /^with +\{[a-zA-Z_]+\}$/;
const RE_LINE = /^([a-zA-Z0-9+]) +([^\t]+)(\t([0-9]+))?$/;
const RE_BLANK_LINE = /^\s*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_CUE = 4;

const botModules = getBotModules();
let target = getTarget();
let validAvatars = {};
let content = [];

describe(`${target} bot script check`, () => {

  it(`loading ${target}/main.json`, async () => {
    const filePath = botModules[target].main;
    content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(content);
    assert(content.length !== 0, `${target}にmain.jsonが見つかりません`);
  });

  it(`retrieving valid Avatars for ${target}`, async () => {
    validAvatars = getValidAvatars(content.avatarDir);
    const van = Object.keys(validAvatars);
    assert(van.length !== 0, `static/chatbot/avatar/${content.avatarDir}が見つかりません`);
  });

  // 

  for (const botModule in botModules[target]) {
    if (botModule === 'main') {
      continue;
    }
    const mods = botModules[target][botModule];
    const content = JSON.parse(fs.readFileSync(mods[botModule], 'utf-8'));

    it(`checking ${botModule}`, () => {
      const script = content.script;
      let lastLine = null;
      for (let i = 0; i < script.length; i++) {
        const line = script[i];

        // コメント行は飛ばす
        if (line.startsWith('#')) {
          continue;
        }

        // タグ行にタグが正しく記載されていること
        if (line.match(RE_TAG_LINE)) {
          continue;
        }

        // with行にタグが指定されていること
        if (line.match(RE_WITH_LINE)) {
          continue;
        }

        //
        const m = line.match(RE_LINE);
        // 行頭がcue,bot,user,{validAvatars}のいずれかであること




      }
    });


  }

});

function getAllFiles(directoryPath, ext) {
  let files = [];

  // Read all items in the directory

  const dirPath = path.resolve(__dirname, directoryPath);

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);

    // Check if the item is a directory or file
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      // Recursively search in the subdirectory
      files = files.concat(getAllFiles(fullPath, ext));
    } else if (stats.isFile() && path.extname(item) === ext) {
      // Add JSON file to the list
      files.push(fullPath);
    }
  }

  return files;
}

function getBotModules() {
  const modules = {};
  const jsonFiles = getAllFiles('../../../static/chatbot/botModules', ".json");
  for (const item of jsonFiles) {
    const m = item.match(/([^./]+)\/([^./]+).json$/);
    if (m[1] !== '_loading') {
      if (m[1] in modules) {
        modules[m[1]][m[2]] = item;
      } else {
        modules[m[1]] = { [m[2]]: item };
      }
    }
  }
  const mn = Object.keys(modules);
  if (mn.length === 0) {
    throw new Error("botModuleがstatic/chatbot/botModulesに見つかりません");
  }
  return modules;
}

function getTarget() {
  const target = process.env.target;
  const botModuleNames = (Object.keys(botModules)).join(',')
  if (!target) {
    throw new Error(usageMessage + `[botModule]には ${botModuleNames} を指定できます。`)
  }

  if (!(target in botModules)) {
    throw new Error(usageMessage +
      `${target} が見つかりません。\n` +
      `[botModule]には ${botModuleNames} を指定できます\n`);
  }

  return target;
}

function getValidAvatars(avatarDir) {
  const avatars = {};
  const svgFiles = getAllFiles(`../../../static/chatbot/avatar/${avatarDir}`, ".svg");
  for (const item of svgFiles) {
    const m = item.match(/([^./]+).svg$/);
    avatars[m[1]] = item;
  }

  return avatars;
}