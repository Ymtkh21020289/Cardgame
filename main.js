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
    let buff = this.buffs
      .filter(b => b.stat === "attack")
      .reduce((sum, b) => sum + b.value, 0);

    let debuff = this.debuffs
      .filter(b => b.stat === "attack")
      .reduce((sum, b) => sum + b.value, 0);

    return buff + debuff;
  }

  draw(){
    while(this.hand.length<3 && this.deck.length){
      this.hand.push(this.deck.pop());
    }
  }

  startTurn(){
    this.actionCount=1;
    this.draw();
    updateUI();
  }

  useCard(i){
    if(this.actionCount<=0)return;
  
    const id=this.hand.splice(i,1)[0];
    const c=cards[id];
  
    // ===== 攻撃 =====
    if(c.type==="attack"){
      let dmg = c.power + this.getAttackModifier();
      this.enemyHP -= dmg;
  
      // 毒付与
      if(c.effect?.poison){
        this.enemyStatus.push({
          type: "poison",
          value: c.effect.poison,
          duration: c.effect.duration
        });
      }
    }
  
    // ===== 回復 =====
    if(c.type==="heal"){
      this.playerHP += c.power;
    }
  
    // ===== バフ =====
    if(c.type==="buff"){
      this.buffs.push({
        stat: c.effect.stat,
        value: c.power,
        duration: c.duration
      });
    }
  
    // ===== デバフ =====
    if(c.type==="debuff"){
      this.debuffs.push({
        stat: c.effect.stat,
        value: c.power,
        duration: c.duration
      });
    }
  
    // ===== 特殊 =====
    if(c.type==="special"){
      if(c.effect?.extraAction) this.actionCount++;
    }
  
    if(!c.exhaust){
      this.deck.push(id);
    }
    
    this.actionCount--;
  
    updateUI();
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
      if(s.type==="poison"){
        this.enemyHP -= s.value;
      }
      s.duration--;
    });
  
    this.enemyStatus = this.enemyStatus.filter(s=>s.duration>0);
  
    // ===== バフ減少 =====
    this.buffs.forEach(b=>b.duration--);
    this.buffs = this.buffs.filter(b=>b.duration>0);
  
    this.debuffs.forEach(b=>b.duration--);
    this.debuffs = this.debuffs.filter(b=>b.duration>0);
  
    // ===== 敵攻撃 =====
    this.enemyTurn();
  
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
    div.textContent=c.name;
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
