import type { Tag } from './domain'

// Each entry is an editable phrase, never a model-dependent instruction template.
// Rows are: Japanese label | English phrase | optional Japanese search aliases.
const extraTags: Tag[] = []
function add(category: string, group: string, rows: string, mature = false) {
  for (const row of rows.trim().split('\n')) {
    const [label, english, aliases = ''] = row.split('|')
    const slug = english.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    extraTags.push({ id: `${mature ? 'mature' : 'ext'}-${slug}`, label, english, category, group,
      keywords: aliases.split('、').filter(Boolean), ...(category === 'negative' ? { negative: true } : {}), ...(mature ? { mature: true } : {}) })
  }
}

add('outfit', 'tops', `
タートルネック|turtleneck|ハイネック、冬服
ノースリーブ|sleeveless shirt|袖なし
ポロシャツ|polo shirt|襟付き、スポーツ
セーター|sweater|毛糸、冬服
スウェット|sweatshirt|トレーナー、普段着
チュニック|tunic|ゆったり
ベスト|vest|ジレ、重ね着
フリルブラウス|frilled blouse|ひらひら、上品
リネンシャツ|linen shirt|麻、夏服
ボーダーシャツ|striped shirt|しましま、縞
オーバーサイズシャツ|oversized shirt|ゆったり、大きめ
オフショルダートップス|off-shoulder top|肩出し
`)
add('outfit', 'outerwear', `
トレンチコート|trench coat|春服、コート
ロングコート|long coat|冬服、アウター
ダッフルコート|duffle coat|冬服
ダウンジャケット|down jacket|防寒
デニムジャケット|denim jacket|ジージャン
レザージャケット|leather jacket|革、ライダース
ブレザー|blazer|ジャケット、きれいめ
ボレロ|bolero|羽織り
ポンチョ|poncho|ケープ
レインコート|raincoat|雨具、かっぱ
ウインドブレーカー|windbreaker|スポーツ、運動
`)
add('outfit', 'bottoms', `
ロングスカート|long skirt|マキシ丈
フレアスカート|flared skirt|広がるスカート
タイトスカート|pencil skirt|ペンシル、きれいめ
ティアードスカート|tiered skirt|段々、フリル
ワイドパンツ|wide-leg pants|ゆったり、長ズボン
スラックス|slacks|スーツ、きれいめ
カーゴパンツ|cargo pants|ポケット、作業着
キュロット|culottes|スカート風
オーバーオール|overalls|サロペット、つなぎ
レギンス|leggings|運動、スパッツ
`)
add('outfit', 'outfit-set', `
スーツ|business suit|ビジネス、仕事
パンツスーツ|pantsuit|ビジネス、仕事
エプロンドレス|apron dress|料理、家事
浴衣|yukata|夏祭り、和装
振袖|furisode|和服、成人式
袴|hakama|和装、卒業式
チャイナドレス|cheongsam|旗袍、中華
ロングドレス|evening gown|パーティー、フォーマル
ウェディングドレス|wedding dress|結婚式、花嫁
ジャージ|tracksuit|運動着、スポーツ
スポーツウェア|sportswear|運動、トレーニング
パジャマ|pajamas|部屋着、寝間着
魔法使いのローブ|wizard robe|魔術師、ファンタジー
鎧|armor|騎士、ファンタジー
宇宙服|spacesuit|宇宙、SF
探検家の服|explorer outfit|冒険、アウトドア
`)
add('outfit', 'shoes', `
パンプス|pumps|ヒール、きれいめ
ハイヒール|high heels|フォーマル
メリージェーン|mary janes|ストラップシューズ
サンダル|sandals|夏、履物
下駄|geta|和装、浴衣
草履|zori|和服、履物
レースアップブーツ|lace-up boots|編み上げ
アンクルブーツ|ankle boots|ショートブーツ
長靴|rain boots|雨具、レインブーツ
バレエシューズ|ballet flats|フラットシューズ
`)
add('outfit', 'hat', `
麦わら帽子|straw hat|夏、日よけ
キャップ|baseball cap|野球帽
ニット帽|beanie|冬、毛糸
シルクハット|top hat|フォーマル、手品
つば広帽子|wide-brimmed hat|日よけ
ヘッドドレス|headdress|髪飾り
`)
add('outfit', 'multi:accessory', `
ネックレス|necklace|首飾り、アクセサリー
ペンダント|pendant|首飾り
ブレスレット|bracelet|腕輪
腕時計|wristwatch|時計
指輪|ring|アクセサリー
ブローチ|brooch|飾り
ヘアピン|hairpin|髪留め
カチューシャ|hairband|髪飾り
シュシュ|scrunchie|髪留め
マフラー|scarf|冬、防寒
手袋|gloves|防寒、手
ショルダーバッグ|shoulder bag|鞄、かばん
リュック|backpack|鞄、かばん
トートバッグ|tote bag|鞄、かばん
`)
add('outfit', 'multi:clothing-detail', `
レース装飾|lace trim|飾り、繊細
フリル装飾|frills|ひらひら
刺繍|embroidery|模様、装飾
花柄|floral print|花模様
水玉模様|polka dots|ドット
チェック柄|checkered pattern|格子柄
ベルベット素材|velvet fabric|ビロード、生地
サテン素材|satin fabric|光沢、生地
デニム素材|denim fabric|生地、ジーンズ
編み目のある生地|knitted fabric|ニット、毛糸
`)

add('pose', 'posture', `
ひざまずく|kneeling|膝立ち
しゃがむ|squatting|屈む
正座|seiza|座る、和風
あぐら|sitting cross-legged|座る、胡坐
椅子に座る|sitting on a chair|着席
床に座る|sitting on the floor|座る
横座り|sitting sideways|座る
壁にもたれる|leaning against a wall|寄りかかる
机にもたれる|leaning on a table|寄りかかる
片膝をつく|on one knee|膝立ち
仰向け|lying on back|寝転ぶ
横向きに寝る|lying on side|寝転ぶ
うつ伏せ|lying on stomach|寝転ぶ
ジャンプ|jumping|跳ぶ
踊る|dancing|ダンス
振り返る|looking back|後ろを見る
`)
add('pose', 'hands', `
手を後ろで組む|hands behind back|後ろ手
両手を上げる|arms up|挙手、バンザイ
片手を上げる|one arm up|挙手
手をつなぐ|holding hands|手
頬杖をつく|hand on cheek|頬に手
顎に手を添える|hand on chin|考える
髪に触れる|touching hair|髪を整える
胸元に手を添える|hand on own chest|手の位置
指を唇に添える|finger to mouth|しー、内緒
ハートをつくる|heart hands|手のハート
手を差し伸べる|reaching out|手を伸ばす
両手を合わせる|palms together|合掌
敬礼|saluting|手のポーズ
手をポケットに入れる|hands in pockets|ポケット
`)
add('pose', 'legs', `
片脚を上げる|one leg raised|足の位置
つま先立ち|tiptoes|背伸び
脚を伸ばして座る|legs outstretched|座る
膝を抱える|hugging knees|座る
`)
add('pose', 'multi:action', `
本を読む|reading a book|読書
お茶を飲む|drinking tea|ティータイム
コーヒーを持つ|holding a coffee cup|飲み物
花束を持つ|holding a bouquet|花
傘をさす|holding an umbrella|雨、日傘
スマートフォンを持つ|holding a phone|携帯
ギターを弾く|playing guitar|楽器、演奏
歌う|singing|歌、ライブ
絵を描く|drawing|お絵描き
料理をする|cooking|台所
`)

add('expression', 'expression', `
微笑む|soft smile|穏やか、笑顔
満面の笑み|beaming smile|嬉しい、笑顔
照れ笑い|bashful smile|恥ずかしい、笑顔
得意げな笑顔|confident smile|自信、笑顔
いたずらな笑顔|mischievous smile|いたずら、笑顔
落ち着いた表情|calm expression|穏やか
眠そうな表情|sleepy expression|眠い
困り顔|troubled expression|困る
考え込む表情|thoughtful expression|考える
不思議そうな表情|puzzled expression|疑問
不満そうな表情|pouting|拗ねる
怒った表情|angry expression|怒る
悲しそうな表情|sad expression|悲しい
泣く|crying|涙
声を出して笑う|laughing|大笑い
決意した表情|determined expression|決心
無表情|expressionless|クール
`)
add('expression', 'gaze', `
上を見る|looking up|視線
下を見る|looking down|視線
横を見る|looking to the side|視線
遠くを見る|looking into the distance|視線、遠景
窓の外を見る|looking out the window|視線
`)
add('expression', 'eyes-state', `
目を見開く|wide eyes|驚く
半目|half-closed eyes|目、眠い
`)
add('expression', 'multi:expression-detail', `
口を少し開く|slightly open mouth|口
口を閉じる|closed mouth|口
涙目|teary eyes|目、うるうる
頬を膨らませる|puffed cheeks|拗ねる
`)

add('composition', 'framing', `
バストアップ|bust shot|胸上、肖像
腰上|waist up|半身
足元のアップ|feet focus|靴、足元
手元のアップ|hands focus|手、部分
顔の一部をアップ|extreme close-up|接写
遠くから全体を描く|long shot|遠景、引き
`)
add('composition', 'direction', `
斜め前から|three-quarter view|斜め、人物の向き
背中越し|over-the-shoulder view|肩越し
`)
add('composition', 'angle', `
真上から|overhead view|俯瞰、鳥瞰
地面の高さから|ground-level view|ローアングル
傾いたカメラ|dutch angle|斜め、傾き
`)
add('composition', 'multi:layout', `
中央に配置|centered composition|センター、構図
左右対称|symmetrical composition|シンメトリー
三分割構図|rule of thirds|構図
余白を広く|negative space|空間、構図
対角線構図|diagonal composition|斜め、構図
奥行きを強調|strong perspective|遠近感、パース
前景を入れる|foreground elements|手前、構図
窓枠越し|framed by a window|額縁、構図
シルエット|silhouette|影、輪郭
浅い被写界深度|shallow depth of field|背景ぼけ
広角|wide-angle lens|レンズ
望遠|telephoto lens|レンズ
魚眼|fisheye lens|レンズ
`)

add('background', 'place', `
リビング|living room|居間、室内
書斎|study room|机、室内
キッチン|kitchen|台所、室内
図書館|library|本、室内
本屋|bookstore|書店、店
美術館|art museum|展示、室内
音楽室|music room|楽器、室内
アトリエ|art studio|絵、室内
レコーディングスタジオ|recording studio|音楽、室内
花屋|flower shop|店、花
パン屋|bakery|店、パン
レストラン|restaurant|店、食事
テラス席|outdoor cafe terrace|屋外、カフェ
駅のホーム|train platform|鉄道、駅
電車の中|inside a train|鉄道、車内
バス停|bus stop|道路、街
路地|alleyway|街、通り
商店街|shopping street|街、店
横断歩道|crosswalk|街、道路
歩道橋|pedestrian bridge|街、橋
屋上|rooftop|屋外、街
公園|park|緑、屋外
桜並木|cherry blossom avenue|春、花、屋外
神社|shrine|和風、屋外
鳥居|torii gate|神社、和風
竹林|bamboo forest|自然、和風
森|forest|自然、木
湖畔|lakeside|自然、水辺
川辺|riverside|自然、水辺
滝|waterfall|自然、水
草原|grassland|自然、緑
花畑|flower field|自然、花
丘の上|hilltop|自然、屋外
山頂|mountain summit|山、自然
雪景色|snowy landscape|冬、自然
砂漠|desert|砂、自然
灯台|lighthouse|海、建物
港|harbor|海、船
遊園地|amusement park|屋外、遊び
観覧車|ferris wheel|遊園地
水族館|aquarium|魚、室内
城|castle|ファンタジー、建物
城の中庭|castle courtyard|ファンタジー、屋外
魔法の図書館|magical library|ファンタジー、本
近未来都市|futuristic city|SF、街
宇宙船の中|spaceship interior|SF、宇宙
`)
add('background', 'multi:place-detail', `
カーテン|curtains|室内、窓
本棚|bookshelf|本、室内
観葉植物|houseplants|植物、室内
木製家具|wooden furniture|室内
クッション|cushions|室内、ソファ
暖炉|fireplace|室内、冬
石畳|cobblestone pavement|道、街
提灯|paper lanterns|和風、祭り
ネオンサイン|neon signs|街、夜
舞う花びら|falling petals|花、春
落ち葉|fallen leaves|秋、自然
水面の反射|reflections on water|水、自然
`)
add('background', 'weather', `
晴れ|clear sky|天気、青空
曇り|overcast sky|天気、雲
雨|rain|天気、雨粒
雪|snowfall|天気、冬
霧|fog|天気、もや
風が吹く|windy|天気、風
`)
add('background', 'time-of-day', `
朝|morning|時間、早朝
昼|daytime|時間、日中
夕暮れ|dusk|時間、夕方
夜|night|時間、夜景
`)

add('lighting', 'light-type', `
拡散光|diffused lighting|柔らかい光
スタジオ照明|studio lighting|撮影、ライト
映画的な照明|cinematic lighting|映画、ドラマチック
ろうそくの光|candlelight|キャンドル、暖かい
ランプの光|lamplight|室内、暖かい
ネオンの光|neon lighting|夜、街
スポットライト|spotlight|舞台、ライト
`)
add('lighting', 'light-direction', `
横からの光|side lighting|サイドライト
正面からの光|front lighting|フロントライト
上からの光|top lighting|頭上、光
窓からの光|window light|自然光、室内
`)
add('lighting', 'light-time', `
朝の光|morning light|朝日
黄金色の光|golden hour lighting|夕日、ゴールデンアワー
青い薄明かり|blue hour lighting|薄暮、ブルーアワー
`)
add('lighting', 'multi:light-detail', `
木漏れ日|dappled sunlight|木、日差し
光芒|light rays|光の筋
淡い光|subtle glow|ほのか
柔らかい影|soft shadows|影
くっきりした影|hard shadows|影
暖色の光|warm lighting|暖かい、オレンジ
寒色の光|cool lighting|涼しい、青
反射光|reflected light|間接光
`)

add('style', 'render-style', `
セル塗り|cel shading|アニメ塗り
厚塗り|painterly style|絵画
油彩風|oil painting|油絵
鉛筆画|pencil drawing|鉛筆、素描
インク画|ink drawing|ペン、線画
線画|line art|輪郭線
フラットイラスト|flat illustration|平面、シンプル
ドット絵|pixel art|ピクセル、ゲーム
切り絵風|paper cutout style|紙、クラフト
絵本風|storybook illustration|童話、柔らかい
`)
add('style', 'multi:style-detail', `
モノクロ|monochrome|白黒
セピア|sepia|茶色、懐かしい
鮮やかな色|vibrant colors|高彩度
落ち着いた色|muted colors|低彩度
限られた色数|limited palette|配色
暖色中心|warm color palette|配色
寒色中心|cool color palette|配色
繊細な線|delicate linework|線画、細い線
太い輪郭線|bold outlines|線画
紙の質感|paper texture|素材、テクスチャ
`)
add('style', 'multi:effect', `
舞うほこり|floating dust particles|空気、粒子
フィルム粒子|film grain|質感、ノイズ
光のフレア|lens flare|光、レンズ
柔らかな光のにじみ|bloom effect|光、発光
動きの残像|motion blur|動作、ぼけ
集中線|radial speed lines|漫画、演出
`)

add('appearance', 'hair-style', `
ボブヘア|bob cut|おかっぱ、短髪
編み込み|braided hair|三つ編み
サイドポニーテール|side ponytail|横結び
お団子ヘア|hair bun|まとめ髪
ハーフアップ|half updo|まとめ髪
ウェーブヘア|wavy hair|巻き髪
くせ毛|curly hair|カール
ストレートヘア|straight hair|直毛
`)
add('appearance', 'hair-color', `
茶髪|brown hair|ブラウン
赤髪|red hair|レッド
ピンク髪|pink hair|桃色
紫髪|purple hair|パープル
銀髪|silver hair|シルバー
緑髪|green hair|グリーン
オレンジ髪|orange hair|橙色
`)
add('appearance', 'eye-color', `
赤い瞳|red eyes|目、レッド
紫の瞳|purple eyes|目、パープル
金色の瞳|golden eyes|目、ゴールド
灰色の瞳|grey eyes|目、グレー
琥珀色の瞳|amber eyes|目、アンバー
`)
add('appearance', 'multi:hair-detail', `
前髪|bangs|髪、フリンジ
横分けの前髪|side-swept bangs|髪
ぱっつん前髪|blunt bangs|髪
アホ毛|ahoge|髪
顔周りの後れ毛|face-framing hair|髪
風になびく髪|hair blowing in the wind|髪、風
`)
add('appearance', 'multi:appearance-detail', `
そばかす|freckles|顔、肌
ほくろ|mole|顔、肌
オッドアイ|heterochromia|目、左右異色
エルフの耳|pointy ears|ファンタジー、耳
`)

add('negative', 'multi:negative', `
低解像度|lowres|画質
圧縮ノイズ|jpeg artifacts|画質、ノイズ
ピントずれ|out of focus|ぼけ、画質
過度な露出|overexposed|明るすぎる
暗すぎる|underexposed|露出
色あせ|washed out colors|色
過剰な彩度|oversaturated|色
人体の崩れ|bad anatomy|体、作画
比率の崩れ|bad proportions|体、作画
余分な腕|extra arms|体、作画
余分な脚|extra legs|体、作画
指の欠損|missing fingers|手、作画
指の癒着|fused fingers|手、作画
顔の歪み|deformed face|顔、作画
左右の目の不一致|asymmetrical eyes|目、作画
切れた頭|cropped head|構図
画面外の人物|out of frame|構図
署名|signature|文字
ロゴ|logo|文字
重複した人物|duplicate character|人物
`)

// Non-graphic adult fashion. Hidden by default; no automatic selection.
add('outfit', 'outfit-set', `
ランジェリー|lingerie|下着、成人向け衣装
レースランジェリー|lace lingerie|下着、成人向け衣装
サテンランジェリー|satin lingerie|下着、光沢
黒いランジェリー|black lingerie|下着、成人向け衣装
ビキニ|bikini|水着、成人向け衣装
ハイウエストビキニ|high-waisted bikini|水着
ホルターネックビキニ|halter bikini|水着
ワンピース水着|one-piece swimsuit|水着
ナイトガウン|nightgown|寝間着、成人向け衣装
レース付きナイトガウン|lace-trimmed nightgown|寝間着
サテンのスリップ|satin slip|部屋着、光沢
`, true)
add('outfit', 'tops', `
シルクキャミソール|silk camisole|部屋着、絹
レースキャミソール|lace camisole|部屋着
`, true)
add('outfit', 'outerwear', `
シルクのローブ|silk robe|ガウン、絹
サテンのローブ|satin robe|ガウン、光沢
`, true)
add('outfit', 'legwear', `
ストッキング|stockings|脚衣装
不透明なストッキング|opaque stockings|脚衣装
網タイツ|fishnet stockings|脚衣装
レーストップのストッキング|lace-top stockings|脚衣装
`, true)
add('outfit', 'multi:accessory', `
パレオ|sarong|水着、腰巻き
`, true)

export { extraTags }
