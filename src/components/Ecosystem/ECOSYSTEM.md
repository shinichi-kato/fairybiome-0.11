ECOSYSTEM
=======================================

ecosystemの目的は
1. 現在の天候、時刻、季節に即した画面表示のための情報提供
2. 天候の変化をecosystemのメッセージとして通知
3. ユーザやボットの発言に不可視のecosys特徴量を付与
の３点である。

## 日付時刻で決まる情報
季節（春夏秋冬）、昼夜の情報は日付時刻の情報から一意に決まる。


そのためログにはタイムスタンプ情報が残っていれば十分である。


## 時刻で決まらない情報
天候と場所がある。
天候 tag                    略号
-----------------------------------
快晴 {ECOSYS_CLEAR}         CLE
晴れ {ECOSYS_SUNNY}         SUN
曇り {ECOSYS_CLOUDY}        CLO
雨   {ECOSYS_RAIN}          RAI
雷   {ECOSYS_THURNDER}      THR
台風 {ECOSYS_STORM}         STM
雪   {EOSYS_SNOW}           SNW
霧   {ECOSYS_FOG}           FOG
吹雪 {ECOSYS_BLIZZARD}      BLZ

場所
室内  {ECOSYS_ROOM}
以下未定