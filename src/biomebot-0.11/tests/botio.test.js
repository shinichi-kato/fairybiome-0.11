import { describe, expect, it } from 'vitest';
import {} from '../botio';

describe("bot i/o",()=>{
  const now = new Date();
  const scheme={
    updatedAt: now,
    botModules: [
      {
        fsid:null,
        data: {
          botId: "user00Test01",
          schemeName:"Test01",
          moduleName:"main.json",
          updatedAt: now,
          avatarDir: "FairyGirl",
          backgroundColor: "#2366ed",
          alarms: {
            monday: {
              year: null,
              month: null,
              date: null,
              day: 'Monday',
              hour: null,
              min: null
            }
          }
        },
        memory: {
          RESPONSE_INTERVALS: [300,400],
          AWAKENING_HOUR: [8,7],
          BEDTIME_HOUR: [22],
          I: ["私","あたし"],
          YOU: ["きみ","君"],
        }
      },
      {
        fsid:null,
        data:{
          botId: "user00Test01",
          schemeName:"Test01",
          moduleName:"greeting.json",  
          updatedAt: now,
          script: [
            "with {!greeting}",
            "user こんにちは",
            "bot こんにちは{+greeting}"
          ]
        }
      }
    ]
  };

  it("uploadDxScheme",()=>{

  });
})