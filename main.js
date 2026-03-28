// ===== データ =====
let cards = {};
let characters = {};

// ===== 所持（Set → 配列保存）=====
let ownedChars = new Set();

// ===== 編成 =====
let selectedChars = [];

// ===== 確率 =====
const rates = { N:0.7, R:0.25, SR:0.05 };

// ===== ロード =====
async function loadData(){
  cards = await fetch("data/cards.json").then(r=>r.json());
  characters = await fetch("data/characters.json").then(r=>r.json());

  loadSave(); // ← ここ重要
}
loadData();

// ===== セーブ =====
function saveGame(){
  const data = {
    ownedChars: [...ownedChars],
    selectedChars: selectedChars
  };
  localStorage.setItem("myGameSave", JSON.stringify(data));
}

// ===== ロード =====
function loadSave(){
  const data = JSON.parse(localStorage.getItem("myGameSave"));

  if(!data) return;

  ownedChars = new Set(data.ownedChars || []);
  selectedChars = data.selectedChars || [];

  updateOwned();
}

// ===== 画面 =====
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== ガチャ =====
function getRarity(){
  const r=Math.random();
  if(r<rates.SR)return"SR";
  if(r<rates.SR+rates.R)return"R";
  return"N";
}

function drawCharacter(){
  const rarity=getRarity();
  const pool=Object.keys(characters).filter(id=>characters[id].rarity===rarity);
  return pool[Math.floor(Math.random()*pool.length)];
}

function drawCharacterUI(){
  const id=drawCharacter();
  ownedChars.add(id);

  saveGame(); // ★追加
  updateOwned();
}

// ===== 10連 =====
function draw10UI(){
  let results=[];

  for(let i=0;i<10;i++){
    let id=drawCharacter();

    if(i===9 && !results.some(r=>characters[r].rarity==="SR")){
      const srPool=Object.keys(characters).filter(id=>characters[id].rarity==="SR");
      id=srPool[Math.floor(Math.random()*srPool.length)];
    }

    results.push(id);
    ownedChars.add(id);
  }

  saveGame(); // ★追加

  alert("10連結果:\n"+results.map(id=>characters[id].name).join("\n"));
  updateOwned();
}

// ===== 所持表示 =====
function updateOwned(){
  ownedCharsDiv.innerHTML="";
  ownedChars.forEach(id=>{
    const div=document.createElement("div");
    div.textContent=characters[id].name;
    ownedCharsDiv.appendChild(div);
  });
}

// ===== 編成 =====
function goSelect(){
  renderSelect();
  showScreen("selectScreen");
}

function goGacha(){
  showScreen("gachaScreen");
}

function renderSelect(){
  charSelect.innerHTML="";

  ownedChars.forEach(id=>{
    const div=document.createElement("div");
    div.className="char";
    div.textContent=characters[id].name;

    // ★ 選択状態復元
    if(selectedChars.includes(id)) {
      div.classList.add("selected");
    }

    div.onclick=()=>{
      if(selectedChars.includes(id)){
        selectedChars=selectedChars.filter(x=>x!==id);
        div.classList.remove("selected");
      }else if(selectedChars.length<4){
        selectedChars.push(id);
        div.classList.add("selected");
      }

      saveGame(); // ★追加
    };

    charSelect.appendChild(div);
  });
}

// ===== バトル =====
class Battle{
  constructor(deck){
    this.playerHP=100;
    this.enemyHP=100;
    this.enemyAttack=10;

    this.deck=deck.sort(()=>Math.random()-0.5);
    this.hand=[];
    this.actionCount=1;
    this.buffs = [];
    this.debuffs = [];
    this.enemyStatus = [];
  }

  getAttackModifier() {
    // 省略（変更なし）
    let buff = this.buffs.filter(b => b.stat === "attack").reduce((sum, b) => sum + b.value, 0);
    let debuff = this.debuffs.filter(b => b.stat === "attack").reduce((sum, b) => sum + b.value, 0);
    return buff + debuff;
  }

  draw(){
    // 省略（変更なし）
    while(this.hand.length<3 && this.deck.length){
      this.hand.push(this.deck.pop());
    }
  }

  startTurn(){
    // 省略（変更なし）
    this.actionCount=1;
    this.draw();
    updateUI();
  }

  // ★ 新規追加：勝敗判定処理
  checkWinLose() {
    if (this.enemyHP <= 0) {
      this.enemyHP = 0; // マイナス表示を防ぐ
      updateUI();
      setTimeout(() => {
        alert("敵を倒した！あなたの勝利です！");
        goSelect(); // リザルト画面や編成画面に戻す
      }, 100);
      return true; // 決着がついたことを返す
    }
    if (this.playerHP <= 0) {
      this.playerHP = 0; // マイナス表示を防ぐ
      updateUI();
      setTimeout(() => {
        alert("敗北しました……。");
        goSelect();
      }, 100);
      return true;
    }
    return false; // まだ決着がついていない
  }

  useCard(i){
    if(this.actionCount<=0)return;
  
    const id=this.hand.splice(i,1)[0];
    const c=cards[id];
  
    // ===== 攻撃 =====
    if(c.type==="attack"){
      let dmg = c.power + this.getAttackModifier();
      this.enemyHP -= dmg;
  
      if(c.effect?.poison){
        this.enemyStatus.push({ type: "poison", value: c.effect.poison, duration: c.effect.duration });
      }
    }
  
    // ===== 回復 =====
    if(c.type==="heal"){
      this.playerHP += c.power;
      // HPの上限を設ける場合はここで調整（例: if(this.playerHP > 100) this.playerHP = 100;）
    }
  
    // ===== バフ / デバフ / 特殊 =====
    if(c.type==="buff") this.buffs.push({ stat: c.effect.stat, value: c.power, duration: c.duration });
    if(c.type==="debuff") this.debuffs.push({ stat: c.effect.stat, value: c.power, duration: c.duration });
    if(c.type==="special"){
      if(c.effect?.extraAction) this.actionCount++;
    }
  
    if(!c.exhaust) this.deck.push(id);
    this.actionCount--;
  
    updateUI();

    // ★ 修正：カード使用後に勝敗判定を行う
    this.checkWinLose();
  }
  
  enemyTurn(){
    this.playerHP-=this.enemyAttack;
  }

  endTurn(){
    // ===== 手札戻す =====
    this.deck.push(...this.hand);
    this.hand=[];
  
    // ===== 毒ダメージ =====
    this.enemyStatus.forEach(s=>{
      if(s.type==="poison") this.enemyHP -= s.value;
      s.duration--;
    });
    this.enemyStatus = this.enemyStatus.filter(s=>s.duration>0);
  
    updateUI(); // 毒のダメージを画面に反映

    // ★ 修正：毒ダメージで敵が倒れたか判定
    if(this.checkWinLose()) return;
  
    // ===== バフ減少 =====
    this.buffs.forEach(b=>b.duration--);
    this.buffs = this.buffs.filter(b=>b.duration>0);
    this.debuffs.forEach(b=>b.duration--);
    this.debuffs = this.debuffs.filter(b=>b.duration>0);
  
    // ===== 敵攻撃 =====
    this.enemyTurn();
  
    // ★ 修正：敵の攻撃で自分が倒れたか判定
    if(this.checkWinLose()) return;
  
    this.startTurn();
  }
}
let battle;

// ===== 開始 =====
function startGame(){
  if(selectedChars.length!==4){
    alert("4人選んでください");
    return;
  }

  let deck=[];
  selectedChars.forEach(id=>{
    deck.push(...characters[id].cards);
  });

  battle=new Battle(deck);

  showScreen("battleScreen");
  battle.startTurn();
}

// ===== UI =====
function updateUI(){
  playerHP.textContent=battle.playerHP;
  enemyHP.textContent=battle.enemyHP;
  actionCount.textContent=battle.actionCount;
  const playerStatusDiv = document.getElementById("playerStatus");
  const enemyStatusDiv = document.getElementById("enemyStatus");

  hand.innerHTML="";
  battle.hand.forEach((id,i)=>{
    const c=cards[id];
    const div=document.createElement("div");
    div.className="card "+c.type;
    
    // カード名
    const nameDiv = document.createElement("div");
    nameDiv.className = "card-name";
    nameDiv.textContent = c.name;
    
    // カード効果
    const descDiv = document.createElement("div");
    descDiv.className = "card-desc";
    descDiv.innerHTML = getCardDescription(c);
    
    div.appendChild(nameDiv);
    div.appendChild(descDiv);
    
    div.onclick=()=>battle.useCard(i);
    hand.appendChild(div);
  });

  playerStatusDiv.innerHTML = "";
  battle.buffs.forEach(b => {
    const div = document.createElement("div");
    div.className = "status-box buff";
    div.textContent = `${b.stat}+${b.value} (${b.duration})`;
    playerStatusDiv.appendChild(div);
  });
  
  battle.debuffs.forEach(d => {
    const div = document.createElement("div");
    div.className = "status-box debuff";
    div.textContent = `${d.stat}${d.value} (${d.duration})`;
    playerStatusDiv.appendChild(div);
  });
  
  // ===== 敵状態 =====
  enemyStatusDiv.innerHTML = "";
  battle.enemyStatus.forEach(s => {
    const div = document.createElement("div");
    div.className = "status-box poison";
    div.textContent = `${s.type} ${s.value} (${s.duration})`;
    enemyStatusDiv.appendChild(div);
  });
}

function nextTurn(){ battle.endTurn(); }

// DOM
const ownedCharsDiv=document.getElementById("ownedChars");

function getCardDescription(c) {
  let desc = "";
  
  if (c.type === "attack") {
    desc += `ダメージ: ${c.power}`;
    if (c.effect?.poison) {
      desc += `<br>毒付与: ${c.effect.poison} (${c.effect.duration}T)`;
    }
  } else if (c.type === "heal") {
    desc += `回復: ${c.power}`;
  } else if (c.type === "buff" || c.type === "debuff") {
    const statName = c.effect.stat === "attack" ? "攻撃力" : c.effect.stat;
    const sign = c.power > 0 ? "+" : "";
    desc += `${statName}${sign}${c.power} (${c.duration}T)`;
  } else if (c.type === "special") {
    if (c.effect?.extraAction) desc += `行動回数+${c.effect.extraAction}`;
  }

  // 使い切り（除外）フラグの表示
  if (c.exhaust) {
    desc += `<br><span style="color:#f1c40f; font-size:0.9em;">※一度のみ</span>`;
  }
  
  return desc;
}
