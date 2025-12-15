import Phaser from 'phaser';
import { BaseGame, PlayerData } from './BaseGame';

interface KahootPlayer extends PlayerData {
  selected?: number;
  submitted?: boolean;
  score?: number;
  lastInputAt?: number;
  correctCount?: number;
}

interface Question {
  q: string;
  choices: string[];
  a: number;
}

const QUESTION_BANK: Question[] = [
  { q: 'What is the capital of France?', choices: ['Paris','London','Rome','Berlin'], a: 0 },
  { q: 'Which planet is known as the Red Planet?', choices: ['Earth','Venus','Mars','Jupiter'], a: 2 },
  { q: 'What is 2 + 2?', choices: ['3','4','5','6'], a: 1 },
  { q: 'What color do you get by mixing red and white?', choices: ['Pink','Purple','Orange','Brown'], a: 0 },
  { q: 'Which gas do plants absorb?', choices: ['Oxygen','Nitrogen','Carbon Dioxide','Hydrogen'], a: 2 },
  { q: 'Who wrote Romeo and Juliet?', choices: ['Dante','Cervantes','Shakespeare','Homer'], a: 2 },
  { q: 'What is the largest ocean?', choices: ['Atlantic','Indian','Pacific','Arctic'], a: 2 },
  { q: 'Which instrument has keys, pedals and strings?', choices: ['Guitar','Piano','Violin','Flute'], a: 1 },
  { q: 'How many continents are there?', choices: ['5','6','7','8'], a: 2 },
  { q: 'What is H2O?', choices: ['Salt','Water','Oxygen','Hydrogen'], a: 1 },
];

(function fillBank() {
  const extras: Question[] = [];
  const subjects: Array<[string, string[], number]> = [
    ['What is the largest planet in our solar system?', ['Earth','Jupiter','Saturn','Mars'], 1],
    ['Which element has the chemical symbol O?', ['Gold','Oxygen','Silver','Iron'], 1],
    ['How many legs does a spider have?', ['6','8','10','12'], 1],
    ['What is the boiling point of water (°C)?', ['90','100','110','120'], 1],
    ['Who painted the Mona Lisa?', ['Van Gogh','Picasso','Da Vinci','Rembrandt'], 2],
    ['What is the square root of 81?', ['7','8','9','10'], 2],
    ['Which sport uses a shuttlecock?', ['Tennis','Badminton','Squash','Table Tennis'], 1],
    ['What gas do humans exhale?', ['Oxygen','Nitrogen','Carbon Dioxide','Helium'], 2],
    ['Which country is famous for sushi?', ['China','Japan','Korea','Thailand'], 1],
    ['What is the smallest prime number?', ['0','1','2','3'], 2],
    ['Which instrument is played with a bow?', ['Flute','Trumpet','Violin','Drum'], 2],
    ['Which city hosted the 2012 Summer Olympics?', ['Beijing','London','Rio','Tokyo'], 1],
    ['Which shape has three sides?', ['Square','Triangle','Circle','Hexagon'], 1],
    ['What do you call frozen water?', ['Steam','Ice','Rain','Snow'], 1],
    ['Which month has 28 days at minimum?', ['February','March','April','May'], 0],
    ['What color are emeralds?', ['Blue','Green','Red','Purple'], 1],
    ['How many hours are in a day?', ['12','24','36','48'], 1],
    ['Which animal is known as the king of the jungle?', ['Elephant','Tiger','Lion','Giraffe'], 2],
    ['What is the chemical formula for table salt?', ['NaCl','H2O','CO2','C6H12O6'], 0],
    ['Which continent is Egypt part of?', ['Asia','Europe','Africa','Oceania'], 2],
    ['What is 7 * 6?', ['42','36','48','56'], 0],
    ['Which planet is closest to the Sun?', ['Venus','Mercury','Earth','Mars'], 1],
    ['Which language has the most native speakers?', ['English','Mandarin','Spanish','Hindi'], 1],
    ['What is a baby cat called?', ['Puppy','Kitten','Calf','Foal'], 1],
    ['Which metal is liquid at room temperature?', ['Mercury','Iron','Aluminium','Gold'], 0],
    ['Which instrument has six strings?', ['Violin','Guitar','Flute','Piano'], 1],
    ['What is the capital of Italy?', ['Milan','Naples','Rome','Venice'], 2],
    ['Which sea creature has eight arms?', ['Jellyfish','Octopus','Shark','Dolphin'], 1],
    ['Who wrote "1984"?', ['Orwell','Huxley','Tolkien','Austen'], 0],
    ['Which fruit is used to make guacamole?', ['Apple','Tomato','Banana','Avocado'], 3],
    ['Which metal has the symbol Fe?', ['Copper','Iron','Lead','Zinc'], 1],
    ['What is the tallest mountain in the world?', ['K2','Everest','Kangchenjunga','Lhotse'], 1],
    ['Which organ processes food in the body?', ['Heart','Lungs','Stomach','Kidney'], 2],
    ['What is the main ingredient in bread?', ['Rice','Flour','Corn','Potato'], 1],
    ['Which animal is known for building dams?', ['Beaver','Otter','Duck','Frog'], 0],
    ['What color is the sky on a clear day?', ['Green','Blue','Red','Yellow'], 1],
    ['Which gas makes up most of Earth’s atmosphere?', ['Oxygen','Hydrogen','Nitrogen','Carbon Dioxide'], 2],
    ['What is the past tense of "go"?', ['Goed','Went','Gone','Go'], 1],
    ['Which sport uses a hoop and a ball?', ['Soccer','Basketball','Baseball','Rugby'], 1],
    ['What is the currency of the United Kingdom?', ['Dollar','Euro','Pound','Franc'], 2],
    ['Which animal is the largest mammal?', ['Elephant','Blue Whale','Giraffe','Hippopotamus'], 1],
    ['How many sides does a hexagon have?', ['4','5','6','8'], 2],
    ['Which planet has rings?', ['Venus','Mars','Saturn','Mercury'], 2],
  ];

  for (const s of subjects) extras.push({ q: s[0] as string, choices: s[1] as string[], a: s[2] as number });

  let counter = 1;
  while (QUESTION_BANK.length + extras.length < 150) {
    const q = `What is ${counter} + ${counter}?`;
    const val = counter + counter;
    extras.push({ q, choices: [String(val-1), String(val), String(val+1), String(val+2)], a: 1 });
    counter++;
  }

  QUESTION_BANK.push(...extras);
})();

export default class KahootGame extends BaseGame {
  private scene?: Phaser.Scene;
  private currentIndex = 0;
  private selectedCount = 0;
  private playersState: Map<string, KahootPlayer> = new Map();
  private questionOrder: number[] = [];
  private localPlayerId?: string;
  private gameStartTime = 0;

  constructor(containerId: string) {
    super(containerId, {
      name: 'Quiz Battle',
      description: 'Fast quiz: select the correct answer using your controller',
      minPlayers: 1,
      maxPlayers: 8,
    });
    const poolSize = QUESTION_BANK.length;
    const needed = Math.min(10, poolSize);
    const picked: number[] = [];
    const chosen = new Set<number>();
    while (picked.length < needed) {
      const idx = Math.floor(Math.random() * poolSize);
      if (!chosen.has(idx)) {
        chosen.add(idx);
        picked.push(idx);
      }
    }
    this.questionOrder = picked;
  }

  start(): void {
    this.gameStartTime = Date.now();
    super.start();
  }

  createPhaserConfig(): Phaser.Types.Core.GameConfig {
    const self = this;
    return {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: 800,
      height: 600,
      backgroundColor: '#111',
      scene: {
        preload() {},
        create() {
          self.scene = this;

          const gfx = this.add.graphics();

          const questionBox = this.add.container(400, 120);
          const qBg = this.add.graphics();
          qBg.fillStyle(0x1e1b5b, 1);
          qBg.lineStyle(6, 0xffd54f, 1);
          qBg.fillRoundedRect(-380, -50, 760, 100, 12);
          qBg.strokeRoundedRect(-380, -50, 760, 100, 12);
          questionBox.add(qBg);
          const qText = this.add.text(0, 0, '', { fontSize: '22px', color: '#ffffff', align: 'center', wordWrap: { width: 720 } }).setOrigin(0.5);
          questionBox.add(qText);

          const answerContainers: Phaser.GameObjects.Container[] = [];
          const answerBoxes: Phaser.GameObjects.Graphics[] = [];
          const answerTexts: Phaser.GameObjects.Text[] = [];
          const coords = [ { x: 240, y: 270 }, { x: 560, y: 270 }, { x: 240, y: 390 }, { x: 560, y: 390 } ];
          const BOX_WIDTH = 220;
          const BOX_HEIGHT = 64;
          const BOX_RADIUS = 10;
          const TEXT_WRAP = 260;
          const TEXT_SIZE = '15px';
          const BASE_BORDER = 0x00ff88;
          const BASE_FILL = 0x0f1220;
          const HOVER_BORDER = 0xff3b30;
          const HOVER_FILL = 0x223366;

          for (let i = 0; i < 4; i++) {
            const c = this.add.container(coords[i].x, coords[i].y);
            const box = this.add.graphics();
            box.fillStyle(BASE_FILL, 1);
            box.lineStyle(6, BASE_BORDER, 1);
            box.fillRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
            box.strokeRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
            const t = this.add.text(0, 0, '', { fontSize: TEXT_SIZE, color: '#ffffff', align: 'center', wordWrap: { width: TEXT_WRAP } }).setOrigin(0.5);
            c.add([box, t]);
            answerContainers.push(c);
            answerBoxes.push(box);
            answerTexts.push(t);
          }

          const infoText = this.add.text(400, 480, 'Waiting for players...', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);

          const timerBg = this.add.graphics();
          const timerArc = this.add.graphics();
          const timerLabel = this.add.text(720, 40, '', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
          timerBg.fillStyle(0x071026, 1);
          timerBg.lineStyle(4, BASE_BORDER, 1);
          timerBg.fillCircle(720, 40, 22);
          timerBg.strokeCircle(720, 40, 22);

          function drawTimerArc(percent: number) {
            timerArc.clear();
            const cx = 720;
            const cy = 40;
            const radius = 22;
            const start = -Math.PI/2;
            const end = start + percent * Math.PI * 2;
            timerArc.lineStyle(4, HOVER_BORDER, 1);
            timerArc.beginPath();
            timerArc.arc(cx, cy, radius - 4, start, end, false);
            timerArc.strokePath();
          }

          function renderQuestion(idx: number) {
            const q = QUESTION_BANK[self.questionOrder[idx]];
            if (!q) return;
            qText.setText((idx + 1) + '. ' + q.q);
            self.playersState.forEach(p => { if (typeof p.selected !== 'number') p.selected = 0; });
            for (let i = 0; i < 4; i++) {
              answerTexts[i].setText((String.fromCharCode(65 + i)) + ': ' + q.choices[i]);
              answerBoxes[i].clear();
              answerBoxes[i].fillStyle(BASE_FILL, 1);
              answerBoxes[i].lineStyle(6, BASE_BORDER, 1);
              answerBoxes[i].fillRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
              answerBoxes[i].strokeRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
            }
            infoText.setText('Question ' + (idx + 1) + ' / ' + self.questionOrder.length);
          }

          renderQuestion(self.currentIndex);

          this.time.addEvent({ delay: 200, loop: true, callback: () => {
            if (self.currentIndex >= self.questionOrder.length) return;
            const counts = [0,0,0,0];
            self.playersState.forEach(p => { if (typeof p.selected === 'number') counts[p.selected]++; });
            const local = self.localPlayerId ? self.playersState.get(self.localPlayerId) : undefined;
            const qCurr = QUESTION_BANK[self.questionOrder[self.currentIndex]];
            if (!qCurr) return;
            for (let i=0;i<4;i++) {
              const ct = counts[i];
              answerTexts[i].setText((String.fromCharCode(65 + i)) + ': ' + qCurr.choices[i] + '   (' + ct + ')');
              answerBoxes[i].clear();
              if (local && local.selected === i) {
                answerBoxes[i].fillStyle(HOVER_FILL, 1);
                answerBoxes[i].lineStyle(8, HOVER_BORDER, 1);
                answerBoxes[i].fillRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
                answerBoxes[i].strokeRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
              } else {
                answerBoxes[i].fillStyle(BASE_FILL, 1);
                answerBoxes[i].lineStyle(6, BASE_BORDER, 1);
                answerBoxes[i].fillRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
                answerBoxes[i].strokeRoundedRect(-BOX_WIDTH/2, -BOX_HEIGHT/2, BOX_WIDTH, BOX_HEIGHT, BOX_RADIUS);
              }
            }
          }});

          let secondsLeft = 10;
          let countdownEvent: Phaser.Time.TimerEvent | null = null;

          function startCountdown() {
            secondsLeft = 10;
            timerLabel.setText(String(secondsLeft));
            drawTimerArc(1);
            if (countdownEvent) countdownEvent.remove(false);
            countdownEvent = self.scene!.time.addEvent({ delay: 1000, loop: true, callback: () => {
              secondsLeft--;
              timerLabel.setText(String(secondsLeft));
              drawTimerArc(Math.max(0, secondsLeft/10));
              if (secondsLeft <= 0) {
                const qObj = QUESTION_BANK[self.questionOrder[self.currentIndex]];
                self.playersState.forEach(p => {
                  if (!p.submitted) return;
                  if (p.selected === qObj.a) { p.score = (p.score || 0) + 100; p.correctCount = (p.correctCount || 0) + 1; }
                });

                self.currentIndex++;
                self.playersState.forEach(p => { p.submitted = false; p.selected = 0; });
                if (self.currentIndex >= self.questionOrder.length) {
                  if (countdownEvent) countdownEvent.remove(false);
                  showGameOver();
                } else {
                  answerContainers.forEach(ac => ac.setVisible(true));
                  renderQuestion(self.currentIndex);
                  startCountdown();
                }
              }
            }});
          }

          startCountdown();

          function showGameOver() {
            qText.setText('Game Over');
            try { timerArc.clear(); timerBg.clear(); } catch(e) {}
            timerLabel.setText('');
            answerContainers.forEach(ac => ac.setVisible(false));
            infoText.setText('Final results');
            const scores = Array.from(self.playersState.values()).map(p => ({ id: p.id, name: p.username || p.id, score: p.score || 0 }));
            scores.sort((a,b) => b.score - a.score);

            answerTexts.forEach(t => t.setText(''));

            const podium = self.scene!.add.container(400, 300);
            const baseY = 340;
            const widths = [220, 160, 140];
            const heights = [180, 120, 90];
            const xOffsets = [0, 150, -150];
            const colors = [0xffd54f, 0xc0c0c0, 0xcd7f32];

            for (let i=0;i<3;i++) {
              const box = self.scene!.add.graphics();
              box.fillStyle(0x1b1b2f, 1);
              box.fillRect(xOffsets[i] - widths[i]/2, baseY - heights[i], widths[i], heights[i]);
              box.lineStyle(6, colors[i], 1);
              box.strokeRect(xOffsets[i] - widths[i]/2, baseY - heights[i], widths[i], heights[i]);
              const place = self.scene!.add.text(xOffsets[i], baseY - heights[i] - 24, String(i+1), { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
              podium.add([box, place]);
              const player = scores[i];
              if (player) {
                const nameTxt = self.scene!.add.text(xOffsets[i], baseY - heights[i] + 24, player.name, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
                const scoreTxt = self.scene!.add.text(xOffsets[i], baseY - heights[i] + 52, String(player.score), { fontSize: '14px', color: '#ddd' }).setOrigin(0.5);
                podium.add([nameTxt, scoreTxt]);
              }
            }

            const local = self.localPlayerId ? self.playersState.get(self.localPlayerId) : undefined;
            if (local) {
              const rank = scores.findIndex(s => s.id === local.id);
              if (rank >= 3 || rank === -1) {
                const personal = self.scene!.add.text(400, 520, `Your score: ${local.score || 0}`, { fontSize: '18px', color: '#fff' }).setOrigin(0.5);
                podium.add(personal);
              }
            }

            if (self.localPlayerId) {
              const localP = self.playersState.get(self.localPlayerId);
              if (localP) {
                const token = localStorage.getItem('token');
                if (token) {
                  fetch('/api/games/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ gameName: 'Quiz Battle', result: 'win', score: localP.score || 0, duration: Math.floor((Date.now()-self.gameStartTime)/1000), correct: localP.correctCount || 0 })
                  }).then(() => { fetch('/api/achievements/check', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{}); }).catch(()=>{});
                }
              }
            }
          }
        }
      }
    };
  }

  addPlayer(player: PlayerData): void {
    super.addPlayer(player);
    const kp: KahootPlayer = { ...player, selected: 0, submitted: false, score: 0, lastInputAt: 0 };
    this.playersState.set(player.id, kp);
  }

  removePlayer(playerId: string): void {
    super.removePlayer(playerId);
    this.playersState.delete(playerId);
  }

  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
  }

  handlePlayerInput(playerId: string, action: string, data?: any): void {
    const p = this.playersState.get(playerId);
    if (!p || !this.scene) return;

    if (action === 'joystick' && data) {
      const now = Date.now();
      if (now - (p.lastInputAt || 0) < 220) return;
      p.lastInputAt = now;
      const dx = data.x;
      const dy = data.y;
      let sel = typeof p.selected === 'number' ? p.selected : 0;
      const row = Math.floor(sel / 2);
      const col = sel % 2;
      const rawX = (data.joystickX !== undefined) ? data.joystickX : data.x;
      const rawY = (data.joystickY !== undefined) ? data.joystickY : data.y;
      const dxVal = rawX || 0;
      const dyVal = rawY || 0;
      if (Math.abs(dxVal) > Math.abs(dyVal)) {
        if (dxVal > 0.4 && col === 0) sel = sel + 1;
        else if (dxVal < -0.4 && col === 1) sel = sel - 1;
      } else {
        if (dyVal > 0.4 && row === 0) sel = sel + 2;
        else if (dyVal < -0.4 && row === 1) sel = sel - 2;
      }
      sel = Math.max(0, Math.min(3, sel));
      p.selected = sel;
    } else if (action === 'action') {
      if (!p.submitted && typeof p.selected === 'number') {
        p.submitted = true;
      }
    }
  }

  protected onPlayerAdded(player: PlayerData): void {

  }

  protected onPlayerRemoved(player: PlayerData): void {

  }
}
