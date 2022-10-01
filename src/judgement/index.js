import Input from './input';
import Score from './score';
import InputPoint from './input/point';
import JudgePoint from './point';
import { Container, AnimatedSprite, Graphics  } from 'pixi.js-legacy';

const AllJudgeTimes = {
    bad     : 200,
    good    : 160,
    perfect : 80,

    badChallenge     : 100,
    goodChallenge    : 75,
    perfectChallenge : 40
};

export default class Judgement
{
    constructor(params)
    {
        this.chart    = params.chart;
        this.stage    = params.stage;
        this.textures = params.textures;
        this.sounds   = params.sounds;
        this.paused   = false;

        if (!params.stage) throw new Error('You cannot do judgement without a stage');
        if (!params.chart) throw new Error('You cannot do judgement without a chart');

        this._autoPlay      = params.autoPlay ? !!params.autoPlay : false;
        this._challengeMode = params.challangeMode ? !!params.challangeMode : false;

        this.score       = new Score(this.chart.totalRealNotes, !!params.showFCStatus, !!params.challangeMode, !!params.autoPlay);
        this.input       = new Input({ canvas: params.canvas });
        this.judgePoints = [];

        /* ===== 判定用时间计算 ===== */
        this.judgeTimes = {
            perfect : (!this._challengeMode ? AllJudgeTimes.perfect : AllJudgeTimes.perfectChallenge) / 1000,
            good    : (!this._challengeMode ? AllJudgeTimes.good : AllJudgeTimes.goodChallenge) / 1000,
            bad     : (!this._challengeMode ? AllJudgeTimes.bad : AllJudgeTimes.badChallenge) / 1000
        };
        
        this.calcTick = this.calcTick.bind(this);
        this.calcNote = calcNoteJudge.bind(this);
    }

    createSprites(showInputPoint = true)
    {
        this.score.createSprites(this.stage);
        this.input.createSprite(this.stage, showInputPoint);
        // this.stage.addChild(this.input.sprite);
    }

    resizeSprites(size)
    {
        this.renderSize = size;
        this.score.resizeSprites(size);
        this.input.resizeSprites(size);
    }

    calcTick(currentTime)
    {
        this.createJudgePoints(currentTime);

        this.input.tap.length = 0;
        this.input.calcTick();
    }

    createJudgePoints(currentTime)
    {
        this.judgePoints.length = 0;

        if (!this._autoPlay)
        {
            for (const tap of this.input.tap)
            {
                if (tap instanceof InputPoint) this.judgePoints.push(new JudgePoint(tap.x, tap.y, 1));
            }

            for (const id in this.input.inputs)
            {
                if (this.input.inputs[id] instanceof InputPoint)
                {
                    if (this.input.inputs[id].time > 0) this.judgePoints.push(new JudgePoint(this.input.inputs[id].x, this.input.inputs[id].y, 3));
                    else if (this.input.inputs[id].isMove) this.judgePoints.push(new JudgePoint(this.input.inputs[id].x, this.input.inputs[id].y, 2));
                }
            }
        }
    }

    createClickAnimate(x, y, type)
    {
        let cont = new Container();
        let anim = new AnimatedSprite(type >= 3 ? this.textures.normal : this.textures.bad);
        let blocks = [ null, null, null, null ];

        cont.position.set(x, y);
        cont.scale.set(this.renderSize.noteScale * 5.6);

        anim.anchor.set(0.5);
        anim.position.set(0, 0);
        anim.tint = type === 4 ? 0xFFECA0 : type === 3 ? 0xB4E1FF : 0x6c4343;

        anim.scale.set(256 / anim.texture.baseTexture.width);
        anim.type = type;
        anim.loop = false;

        if (type >= 3)
        {
            for (let i = 0; i < blocks.length; i++)
            {
                blocks[i] = new Graphics()
                    .beginFill(type === 4 ? 0xFFECA0 : 0xB4E1FF)
                    .drawCircle(0, 0, 15)
                    .endFill();
                
                blocks[i].cacheAsBitmap = true;
                blocks[i].distance = blocks[i]._distance = Math.random() * 81 + 185;
                blocks[i].direction = Math.floor(Math.random() * 360);
				blocks[i].sinr = Math.sin(blocks[i].direction);
				blocks[i].cosr = Math.cos(blocks[i].direction);

                cont.addChild(blocks[i]);
            }
            anim.blocks = blocks;
        }

        anim.onFrameChange = function () {
            let currentFrameProgress = (this.currentFrame / this.totalFrames);
            this.parent.alpha = 1 - currentFrameProgress;

            if (this.blocks instanceof Array)
            {
                for (let i = 0; i < this.blocks.length; i++)
                {
                    this.blocks[i].scale.set(((0.2078 * currentFrameProgress - 1.6524) * currentFrameProgress + 1.6399) * currentFrameProgress + 0.4988);
                    this.blocks[i].distance = this.blocks[i]._distance * (9 * currentFrameProgress / (8 * currentFrameProgress + 1)) * 0.6;

                    this.blocks[i].position.x = this.blocks[i].distance * this.blocks[i].cosr - this.blocks[i].distance * this.blocks[i].sinr;
				    this.blocks[i].position.y = this.blocks[i].distance * this.blocks[i].cosr + this.blocks[i].distance * this.blocks[i].sinr;
                }
            }
        };
        anim.onComplete = function () {
            this.parent.destroy();
        };

        cont.addChild(anim);
        this.stage.addChild(cont);
        anim.play();

        return cont;
    }
}

function calcNoteJudge(currentTime, note)
{
    if (note.isFake) return; // 忽略假 Note
    if (note.isScored && note.isScoreAnimated) return; // 已记分忽略
    if (note.time - this.judgeTimes.bad > currentTime) return; // 不在记分范围内忽略
    
    if (!note.isScored)
    {
        if (note.type !== 3 && note.time + this.judgeTimes.bad < currentTime)
        {
            note.isScored = true;
            note.score = 1;
            note.scoreTime = NaN;

            this.score.pushJudge(0, this.chart.judgelines);

            note.sprite.alpha = 0;
            note.isScoreAnimated = true;
            
            return;
        }
        else if (note.type === 3 && note.time + this.judgeTimes.good < currentTime)
        {
            note.isScored = true;
            note.score = 1;
            note.scoreTime = NaN;

            this.score.pushJudge(0, this.chart.judgelines);

            note.sprite.alpha = 0.5;
            note.isScoreAnimated = true;

            return;
        }
    }
    

    let timeBetween = note.time - currentTime,
        timeBetweenReal = timeBetween > 0 ? timeBetween : timeBetween * -1,
        judgeline = note.judgeline,
        notePosition = note.sprite.position;
    
    if (note.type !== 3 && !note.isScoreAnimated && note.time <= currentTime)
    {
        note.sprite.alpha = 1 + (timeBetween / this.judgeTimes.bad);
    }

    // 自动模式则自行添加判定点
    if (this._autoPlay)
    {
        if (note.type === 1) {
            if (timeBetween <= 0) this.judgePoints.push(new JudgePoint(notePosition.x, notePosition.y, 1));
        } else if (note.type === 2) {
            if (timeBetween <= this.judgeTimes.bad) this.judgePoints.push(new JudgePoint(notePosition.x, notePosition.y, 3));
        } else if (note.type === 3) {
            if (!note.isScored && timeBetween <= 0) this.judgePoints.push(new JudgePoint(notePosition.x, notePosition.y, 1));
            else if (note.isScored && currentTime - note.lastHoldTime <= 0.09) this.judgePoints.push(new JudgePoint(notePosition.x, notePosition.y, 3));
        } else if (note.type === 4) {
            if (timeBetween <= this.judgeTimes.bad) this.judgePoints.push(new JudgePoint(notePosition.x, notePosition.y, 2));
        }
    }

    switch (note.type)
    {
        case 1:
        {
            for (let i = 0; i < this.judgePoints.length; i++)
            {
                if (
                    this.judgePoints[i].type === 1 &&
                    this.judgePoints[i].isInArea(notePosition.x, notePosition.y, judgeline.cosr, judgeline.sinr, this.renderSize.noteWidth)
                ) {
                    if (timeBetweenReal <= this.judgeTimes.bad)
                    {
                        note.isScored = true;
                        note.scoreTime = timeBetween;

                        if (timeBetweenReal <= this.judgeTimes.perfect) note.score = 4;
                        else if (timeBetweenReal <= this.judgeTimes.good) note.score = 3;
                        else note.score = 2;
                    }

                    if (note.isScored)
                    {
                        note.sprite.alpha = 0;
                        note.isScoreAnimated = true;
                        this.createClickAnimate(note.sprite.judgelineX, note.sprite.judgelineY, note.score);
                        this.score.pushJudge(note.score, this.chart.judgelines);

                        this.judgePoints.splice(i, 1);
                        break;
                    }
                }
            }

            break;
        }
        case 2:
        {
            if (note.isScored && !note.isScoreAnimated && timeBetween <= 0)
            {
                this.score.pushJudge(4, this.chart.judgelines);
                this.createClickAnimate(note.sprite.judgelineX, note.sprite.judgelineY, note.score);
                note.sprite.alpha = 0;
                note.isScoreAnimated = true;
            }
            else if (!note.isScored)
            {
                for (let i = 0; i < this.judgePoints.length; i++)
                {
                    if (
                        this.judgePoints[i].isInArea(notePosition.x, notePosition.y, judgeline.cosr, judgeline.sinr, this.renderSize.noteWidth) &&
                        timeBetweenReal <= this.judgeTimes.good
                    ) {
                        note.isScored = true;
                        note.score = 4;
                        note.scoreTime = NaN;
                        break;
                    }
                }
            }
            
            break;
        }
        case 3:
        {
            if (note.isScored)
            {
                if (currentTime - note.lastHoldTime >= 0.15)
                {
                    note.lastHoldTime = currentTime;
                    this.createClickAnimate(note.sprite.judgelineX, note.sprite.judgelineY, note.score);
                }

                if (note.holdTimeLength - currentTime <= this.judgeTimes.bad)
                {
                    this.score.pushJudge(note.score, this.chart.judgelines);
                    note.isScoreAnimated = true;
                    break;
                }
            }
            
            if (currentTime - note.lastHoldTime >= 0.15) note.isHolding = false;

            for (let i = 0; i < this.judgePoints.length; i++)
            {
                if (
                    !note.isScored &&
                    this.judgePoints[i].type === 1 &&
                    this.judgePoints[i].isInArea(notePosition.x, notePosition.y, judgeline.cosr, judgeline.sinr, this.renderSize.noteWidth) &&
                    timeBetweenReal <= this.judgeTimes.good
                ) {
                    note.isScored = true;
                    note.scoreTime = timeBetween;

                    if (timeBetweenReal <= this.judgeTimes.perfect) note.score = 4;
                    else note.score = 3;

                    this.createClickAnimate(note.sprite.judgelineX, note.sprite.judgelineY, note.score);
                    
                    note.isHolding = true;
                    note.lastHoldTime = currentTime;

                    this.judgePoints.splice(i, 1);
                    break;
                }
                else if (
                    note.isScored &&
                    this.judgePoints[i].isInArea(notePosition.x, notePosition.y, judgeline.cosr, judgeline.sinr, this.renderSize.noteWidth)
                ) {
                    note.isHolding = true;
                }
            }

            if (!this.paused && note.isScored && !note.isHolding)
            {
                note.score = 1;
                note.scoreTime = NaN;
                
                this.score.pushJudge(1, this.chart.judgelines);

                note.sprite.alpha = 0.5;
                note.isScoreAnimated = true;
            }

            break;
        }
        case 4:
        {
            if (note.isScored && !note.isScoreAnimated && timeBetween <= 0)
            {
                this.score.pushJudge(4, this.chart.judgelines);
                this.createClickAnimate(note.sprite.judgelineX, note.sprite.judgelineY, note.score);
                note.sprite.alpha = 0;
                note.isScoreAnimated = true;
            }
            else if (!note.isScored)
            {
                for (let i = 0; i < this.judgePoints.length; i++)
                {
                    if (
                        this.judgePoints[i].type === 2 &&
                        this.judgePoints[i].isInArea(notePosition.x, notePosition.y, judgeline.cosr, judgeline.sinr, this.renderSize.noteWidth) &&
                        timeBetweenReal <= this.judgeTimes.good
                    ) {
                        note.isScored = true;
                        note.score = 4;
                        note.scoreTime = NaN;
                        break;
                    }
                }
            }

            break;
        }
    }
}