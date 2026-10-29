import { UI } from '../../config/ui';
import Phaser from 'phaser';
import type { MachineRuntime } from '../../runtime/machine';
import type { PressPart } from '../../runtime/press';
import { activePressPart, pressHeadTarget } from '../../runtime/press';
import { automated, direction } from '../../game/machines';
import { angleDelta, CRANK, driveAngle, inPlate, inTray, recentDownSpeed, resistedHeadTravel, TAU, validStamp } from '../../game/gestures';
import type { PressTextures } from './textures';

export const RENDER_SCALE = 2;
type Drag = { part: PressPart; pointer: number; x: number; y: number; startY: number; lastY: number; time: number; speed: number; angle: number };
/** Presentation loop only. No production clock, economy, upgrades, or phase transitions live here. */
export class MoneyPressScene extends Phaser.Scene {
  private runtime: MachineRuntime;
  private sources: PressTextures;
  private host: HTMLElement;
  private pieces: Record<string, Phaser.GameObjects.Image> = {};
  private gears: { object: Phaser.GameObjects.Image; kind: 'drive' | 'second' | 'feed' | 'motor' | 'collect' }[] = [];
  private stampLamp?: Phaser.GameObjects.Arc;
  private head!: Phaser.GameObjects.Image;
  private shaft!: Phaser.GameObjects.Rectangle;
  private crank!: Phaser.GameObjects.Image;
  private paper!: Phaser.GameObjects.Image;
  private bill!: Phaser.GameObjects.Image;
  private trayBill!: Phaser.GameObjects.Image;
  private cue!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private drag: Drag | null = null;
  private rotation = 0;
  private headY = 340;
  private velocity = 0;
  private lastRatchet = 0;
  private lastPhase: string;
  private lastBills: number;
  private reduced = false;
  private telemetry = 0;
  constructor(runtime: MachineRuntime, sources: PressTextures, host: HTMLElement) {
    super('money-press-evaluation'); this.runtime = runtime; this.sources = sources; this.host = host;
    const machine = runtime.read(); this.headY = pressHeadTarget(machine); this.rotation = driveAngle(machine.phase, machine.bills, machine.progress);
    this.lastPhase = machine.phase; this.lastBills = machine.bills;
  }
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
    for (const [key, { image }] of Object.entries(this.sources)) this.textures.addImage(key, image);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.add.ellipse(357, 469, 642, 26, 0x303b3b, .12);
    this.place('frame');
    this.gear(462, 232, 26, 'drive'); this.gear(505, 272, 20, 'second');
    for (const name of ['feeder', 'motor', 'collector', 'stamper']) if (this.sources[name]) this.pieces[name] = this.place(name);
    if (this.sources.feeder) this.gear(185, 383, 15, 'feed');
    if (this.sources.motor) this.gear(572, 186, 15, 'motor');
    if (this.sources.collector) for (const x of [446, 473, 500, 527, 553]) this.gear(x, 397, 8, 'collect');
    if (this.sources.stamper) this.stampLamp = this.add.circle(379, 58, 6, 0xe8ddbf).setStrokeStyle(3, 0x303b3b);
    this.bill = this.place('bill');
    this.shaft = this.add.rectangle(354.5, 143, 19, 65, 0xc7c7aa).setOrigin(.5, 0).setStrokeStyle(2, 0x303b3b);
    this.head = this.place('head');
    this.crank = this.place('crank').setPosition(CRANK.x, CRANK.y).setOrigin(.5);
    for (const n of [12, 6, 0]) this.place('blank').setPosition(47 - n / 4, 351 + n);
    this.place('trayBack');
    this.trayBill = this.place('bill').setPosition(556, 378);
    this.place('tray');
    this.paper = this.place('blank');
    this.cue = this.add.graphics();
    this.progressText = this.add.text(556, 352, '', { fontFamily: 'Barlow Condensed', fontSize: '16px', color: '#303b3b' }).setOrigin(.5, 0);
    this.input.on('pointerdown', this.down, this);
    this.input.on('pointermove', this.move, this);
    this.input.on('pointerup', this.up, this);
    this.input.on('pointerupoutside', this.cancel, this);
    const cancel = () => this.cancel();
    window.addEventListener('blur', cancel);
    this.game.canvas.addEventListener('touchcancel', cancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.drag = null; window.removeEventListener('blur', cancel); this.game.canvas.removeEventListener('touchcancel', cancel);
    });
  }
  private place(key: string) {
    const [x, y, w, h] = this.sources[key].bounds;
    return this.add.image(x, y, key).setOrigin(0).setDisplaySize(w, h);
  }
  private gear(x: number, y: number, radius: number, kind: 'drive' | 'second' | 'feed' | 'motor' | 'collect') {
    const object = this.place(`gear${radius}`).setPosition(x, y).setOrigin(.5);
    this.gears.push({ object, kind });
  }
  private hit(part: PressPart, x: number, y: number) {
    const target = Math.max(88, UI.touchTarget * this.scale.displayScale.x / RENDER_SCALE);
    const within = (cx: number, cy: number, w: number, h: number) => Math.abs(x - cx) <= Math.max(w, target) / 2 && Math.abs(y - cy) <= Math.max(h, target) / 2;
    return part === 'paper' ? within(105, 380, 156, 94) : part === 'crank' ? Math.hypot(x - 556, y - 272) <= Math.max(80, target / 2)
      : part === 'head' ? within(355, this.headY + 32, 193, 82) : within(351, 375.5, 116, 53);
  }
  private point(pointer: Phaser.Input.Pointer) { return this.cameras.main.getWorldPoint(pointer.x, pointer.y); }
  private down(pointer: Phaser.Input.Pointer) {
    // Phaser also observes window input; React dialogs and controls must never operate the machine.
    if (pointer.event.target !== this.game.canvas) return;
    const point = this.point(pointer);
    const part = activePressPart(this.runtime.read());
    if (this.drag || !part || !this.hit(part, point.x, point.y) || (pointer.wasTouch === false && pointer.button !== 0)) return;
    this.drag = { part, pointer: pointer.id, x: point.x, y: point.y, startY: point.y, lastY: point.y, time: pointer.event.timeStamp, speed: 0, angle: Math.atan2(point.y - CRANK.y, point.x - CRANK.x) };
    this.runtime.hint(''); this.runtime.feedback('click');
  }
  private move(pointer: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || pointer.id !== d.pointer) return;
    const machine = this.runtime.read();
    if (activePressPart(machine) !== d.part) { this.cancel(); return; }
    const point = this.point(pointer);
    d.x = point.x; d.y = point.y;
    const time = pointer.event.timeStamp;
    if (d.part === 'crank' && Math.hypot(d.x - CRANK.x, d.y - CRANK.y) > 22) {
      const angle = Math.atan2(d.y - CRANK.y, d.x - CRANK.x);
      const delta = angleDelta(d.angle, angle); d.angle = angle;
      this.rotation += delta * 180 / Math.PI;
      this.runtime.act({ type: 'turn', amount: delta * direction(machine) / TAU });
      if (time - this.lastRatchet > 65 && Math.abs(delta) > .035) { this.lastRatchet = time; this.runtime.feedback('click'); }
    }
    if (d.part === 'head') {
      d.speed = recentDownSpeed(d.speed, d.y - d.lastY, time - d.time); d.lastY = d.y; d.time = time;
      if (validStamp(resistedHeadTravel(d.y - d.startY), d.speed)) { this.runtime.act({ type: 'stamp' }); this.drag = null; }
    }
  }
  private up(pointer: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || d.pointer !== pointer.id) return;
    this.drag = null;
    if (pointer.event.target !== this.game.canvas || pointer.event.type === 'touchcancel' || activePressPart(this.runtime.read()) !== d.part) return;
    const point = this.point(pointer);
    if (d.part === 'paper') {
      if (inPlate(point.x, point.y)) { this.runtime.act({ type: 'feed' }); this.runtime.feedback('click'); }
      else this.runtime.hint('Drop paper on the plate.');
    } else if (d.part === 'bill') {
      if (inTray(point.x, point.y)) this.runtime.act({ type: 'collect' });
      else this.runtime.hint('Drop bill in the right tray.');
    } else if (d.part === 'head') this.runtime.hint('Pull down farther and faster.');
  }
  cancel() { this.drag = null; }
  keyboard() {
    const machine = this.runtime.read(), part = activePressPart(machine);
    if (part === 'crank') { this.rotation += 90 * direction(machine); this.runtime.act({ type: 'turn', amount: .25 }); }
    else if (part) this.runtime.act({ type: part === 'paper' ? 'feed' : part === 'head' ? 'stamp' : 'collect' });
  }
  private impact() {
    this.runtime.feedback('stamp');
    if (this.reduced) return;
    this.cameras.main.shake(140, .002);
    for (const [x, y] of [[-70, -12], [-92, -32], [74, -16], [96, -38]]) {
      const dust = this.add.rectangle(354, 390, 5, 5, 0xe8ddbf).setStrokeStyle(1, 0x303b3b);
      this.tweens.add({ targets: dust, x: 354 + x, y: 390 + y, alpha: 0, duration: 300, onComplete: () => dust.destroy() });
    }
  }
  update(_time: number, elapsed: number) {
    if (!this.head) return;
    const machine = this.runtime.read(), auto = automated(machine), part = activePressPart(machine);
    if (this.drag && part !== this.drag.part) this.cancel();
    if (this.lastPhase === 'stamp' && machine.phase === 'lift') this.impact();
    if (machine.bills > this.lastBills && !this.reduced) {
      this.trayBill.y = 372; this.tweens.add({ targets: this.trayBill, y: 378, duration: 220 });
    }
    this.lastPhase = machine.phase; this.lastBills = machine.bills;
    const target = this.drag?.part === 'head' ? 208 + resistedHeadTravel(this.drag.y - this.drag.startY) : pressHeadTarget(machine);
    if (this.reduced || this.drag?.part === 'head' || (machine.phase === 'lift' && machine.progress === 0)) { this.headY = target; this.velocity = 0; }
    else { const dt = Math.min(elapsed / 1000, .025); this.velocity += ((target - this.headY) * 340 - this.velocity * 34) * dt; this.headY += this.velocity * dt; }
    this.stampLamp?.setFillStyle(machine.phase === 'stamp' ? 0x78a58a : 0xe8ddbf);
    this.head.setPosition(256, this.headY - 9); this.shaft.setSize(19, Math.max(0, this.headY - 143));
    const angle = machine.upgrades.includes('motor') ? driveAngle(machine.phase, machine.bills, machine.progress) : this.rotation;
    this.crank.setAngle(angle);
    for (const { object, kind } of this.gears) object.setAngle(kind === 'drive' ? -angle * 2 : kind === 'second' ? angle * 2.6 : kind === 'motor' ? angle * 2 : kind === 'feed' ? (machine.phase === 'feed' ? machine.progress * 360 : 0) : machine.phase === 'collect' ? machine.progress * 540 : 0);
    const draggingPaper = this.drag?.part === 'paper', draggingBill = this.drag?.part === 'bill';
    this.paper.setVisible(draggingPaper || (auto && machine.phase === 'feed'));
    if (draggingPaper) this.paper.setPosition(this.drag!.x - 60, this.drag!.y - 28).setAngle(Phaser.Math.Clamp((this.drag!.x - 350) / 30, -9, 9));
    else this.paper.setPosition(50 + machine.progress * 239, 351 + machine.progress * 29).setAngle(0);
    const collecting = machine.phase === 'collect';
    this.bill.setVisible(machine.phase !== 'feed');
    this.bill.setDisplaySize(120, collecting ? 58 : 11.6).setPosition(289, collecting ? 347 : 383).setAngle(0);
    this.bill.setTexture(machine.phase === 'raise' || machine.phase === 'stamp' ? 'blank' : 'bill');
    if (draggingBill) this.bill.setPosition(this.drag!.x - 60, this.drag!.y - 28).setAngle(Phaser.Math.Clamp((this.drag!.x - 350) / 30, -9, 9));
    else if (collecting && auto) this.bill.setPosition(291 + machine.progress * 267, 347 + machine.progress * 30);
    this.trayBill.setVisible(machine.bills > 0);
    const text = machine.phase === 'raise' || machine.phase === 'lift' ? `${Math.round(machine.progress * 100)}%` : '';
    if (text !== this.progressText.text) this.progressText.setText(text);
    this.cue.clear();
    if (part && !this.drag) {
      this.cue.lineStyle(3, part === 'head' ? 0xe7a343 : 0x303b3b, .7);
      if (part === 'paper') this.cue.lineBetween(178, 379, 242, 379).lineBetween(232, 371, 242, 379).lineBetween(232, 387, 242, 379);
      if (part === 'head') this.cue.lineBetween(355, this.headY + 65, 355, this.headY + 92).lineBetween(346, this.headY + 83, 355, this.headY + 92).lineBetween(364, this.headY + 83, 355, this.headY + 92);
    }
    if (_time - this.telemetry > 1000) { this.host.dataset.fps = this.game.loop.actualFps.toFixed(0); this.telemetry = _time; }
  }
}
