import type { ChessEvent, EventKind } from './PositionAnalyzer';
export const CHARACTERS = {
  alex: {name:'Alex',style:'友好 · 幽默',glyph:'A',intro:'下盘好棋吧。遇到精彩的地方，我可不会吝啬掌声。'},
  victor: {name:'Victor',style:'自信 · 好胜',glyph:'V',intro:'准备好了？棋盘上的胜负，咱们用走法说话。'},
  professor: {name:'Professor',style:'沉稳 · 克制',glyph:'P',intro:'不妨从容一些。让我们看看这盘棋会如何展开。'},
} as const;
export type Character = keyof typeof CHARACTERS;
export type Frequency = 'quiet' | 'normal' | 'chatty';
export interface PersonalityState {confidence:number; frustration:number; respect:number; excitement:number}
export interface Commentary {id:number; ply:number; text:string; fact:string; kind:EventKind; character:Character}
type Lines = Record<Character, readonly [string,string]>;
const lines: Record<EventKind, Lines> = {
  check:{alex:['刚才那次将军，让我认真起来了。','王被点名了，这盘棋热闹起来了。'],victor:['将军？棋盘上的较量才刚开始。','王被盯上了。好，继续。'],professor:['这一步形成了将军。','刚才的将军形成了一次强制应对。']},
  capture:{alex:['又一次吃子。先别急着数战利品。','棋子少了一枚，故事还没讲完。'],victor:['吃到了？交换的账可还没算完。','先别为吃子得意，棋还长着呢。'],professor:['吃子已经发生，得失还需结合后续局面。','不能仅凭这次吃子判断谁占优。']},
  promotion:{alex:['兵走到底了！这一刻值得记住。','一枚小兵，终于换了新身份。'],victor:['升变了。看来棋盘又要热闹了。','小兵也有出头的时候。继续较量。'],professor:['兵已完成升变，棋盘上的力量配置改变了。','升变已经完成，需重新审视局面。']},
  brilliant:{alex:['漂亮，这步战术棋走得很准！','这一步值得鼓掌，我得更认真了。'],victor:['哼，这步确实够准。我记住了。','这次算你走得漂亮，不过别太早高兴。'],professor:['这步战术着法与分析首选一致，值得肯定。','准确的一步。你抓住了眼前的战术机会。']},
  mistake:{alex:['这步有些可惜，别急，继续找机会。','局面吃了点亏，但棋还没结束。'],victor:['这一步松了口气？我可看见了。','这个决定代价不小。继续吧。'],professor:['这步之后，局面评价有所下降。','刚才的选择有些损失，值得赛后再看。']},
  blunder:{alex:['这步损失有些大。稳住，我们接着下。','刚才有点可惜，但别让一步棋影响心情。'],victor:['这份机会，我可收下了。','这步代价很大。你得重新振作了。'],professor:['分析显示，这步造成了明显的局面损失。','刚才的走法损失较大，赛后值得重点复盘。']},
  reversal:{alex:['局势翻过来了！这盘棋越来越有意思了。','优势换边了，真是一场拉锯战。'],victor:['局面居然翻过来了……有意思。','优势换边了。这下可不能大意。'],professor:['前后的稳定评价显示，优势方发生了变化。','这是一次明显的局势逆转。']},
  balanced:{alex:['双方都没松口，这盘挺有嚼劲。','局面还很接近，我可不敢分心。'],victor:['还在僵持？我有耐心。','谁也没拉开差距，那就继续较量。'],professor:['连续几次分析仍接近均势。','目前的评价持续接近，双方都需保持专注。']},
  mate:{alex:['王的处境很紧张，我得打起精神。','这局进入关键时刻了。'],victor:['关键时刻到了。先把这盘下完。','王的处境可不轻松。继续。'],professor:['分析出现了稳定的将杀信号，仍以实际对局结果为准。','王的安全已经成为决定性的因素。']},
  end:{alex:['谢谢这盘棋！精彩的地方，值得再回味一下。','下得过瘾。谢谢你陪我走完这一盘。'],victor:['这盘结束了。下一盘，再分高下。','结果记下了。下一盘，我还会全力以赴。'],professor:['对局结束。感谢切磋，复盘时可以关注关键转折。','感谢这一盘棋。结果之外，过程同样值得回顾。']},
};
const selfMistakes: Lines = {alex:['哎，刚才那步是我没考虑周全。','这步是我下差了，得好好反省。'],victor:['啧，这步确实是我的问题。下次不会这么轻松。','我刚才失算了……这笔账我记下了。'],professor:['我刚才的走法不够准确，造成了局面损失。','这一步是我的判断有误，值得复盘。']};
export class PersonalityManager {
  state: PersonalityState = {confidence:50,frustration:0,respect:30,excitement:0};
  memories: {kind:'taunt'|'respect'; ply:number}[] = [];
  assess(playerScore:number) {
    this.state.confidence = Math.max(0,Math.min(100,this.state.confidence + (playerScore < -100 ? 3 : playerScore > 100 ? -3 : 0)));
  }
  update(event: ChessEvent) {
    this.state.frustration *= .9; this.state.excitement *= .85;
    if (event.kind === 'brilliant' && event.actor === 'player') {this.state.respect += 12; this.state.excitement += 15;}
    if (['mistake','blunder'].includes(event.kind)) {this.state.confidence += event.actor === 'ai' ? -15 : 10; if (event.actor === 'ai') this.state.frustration += 25;}
    if (event.kind === 'reversal') {this.state.excitement += 30; this.state.frustration += (event.playerAdvantage ?? 0) > 0 ? 25 : -10;}
    for (const key of Object.keys(this.state) as (keyof PersonalityState)[]) this.state[key] = Math.max(0,Math.min(100,this.state[key]));
  }
}
/** Semantic cooldowns apply to important events too; a result bypasses them once. */
export class CommentaryScheduler {
  private lastPly = -20;
  private lastTime = -Infinity;
  private gap = 6;
  private recent = new Map<string,number>();
  private ended = false;
  constructor(private random:()=>number = Math.random) {}
  allow(event:ChessEvent, frequency:Frequency, now:number) {
    if (event.kind === 'end') {if (this.ended) return false; this.ended = true; return true;}
    const key = `${event.kind}:${event.actor}`;
    if (event.ply - (this.recent.get(key) ?? -100) < 12) return false;
    if (event.ply === this.lastPly || now - this.lastTime < (event.important ? 2500 : 12000)) return false;
    if ((!event.important || frequency === 'quiet') && event.ply - this.lastPly < this.gap) return false;
    this.recent.set(key,event.ply); this.lastPly = event.ply; this.lastTime = now;
    const base = frequency === 'quiet' ? 12 : frequency === 'chatty' ? 2 : 6;
    this.gap = base + 2 * Math.floor(this.random()*3);
    return true;
  }
}
export class CommentaryGenerator {
  private recent: {text:string;ply:number}[] = [];
  generate(event:ChessEvent, character:Character, manager:PersonalityManager) {
    let choices: readonly string[] = lines[event.kind][character];
    if (event.actor === 'ai' && ['mistake','blunder'].includes(event.kind)) choices = selfMistakes[character];
    if (event.kind === 'brilliant' && event.actor === 'ai') choices = character === 'victor' ? ['这步我算得还不错。继续接招。','这次计算没让我失望。'] : ['这步战术棋，我对自己的计算还算满意。','这次战术处理比较准确，继续下吧。'];
    if (event.kind === 'reversal' && (event.playerAdvantage ?? 0)>0 && manager.memories.some(m=>m.kind==='taunt' && m.ply<event.ply)) {
      choices = ['你真的把局面扳回来了。我开始后悔刚才得意得太早了。'];
    } else if (event.kind === 'brilliant' && event.actor === 'player' && manager.state.respect >= 54) {
      choices = character === 'victor' ? ['又一步好棋……好吧，我得承认你值得认真对待。'] : ['你已经不止一次走出好棋了，我越来越期待你的下一步。'];
    } else if (event.kind === 'reversal' && manager.state.frustration >= 25 && character === 'victor') choices = ['优势丢了……我承认有点懊恼，但这盘还没结束。'];
    if (event.kind === 'end' && event.fact.includes('获胜')) {
      choices = event.actor === 'player'
        ? character === 'victor' ? ['这盘是你赢了。我服这次的结果，下次再来。'] : ['恭喜你赢下这一盘！谢谢切磋。']
        : character === 'victor' ? ['这盘我赢了。谢谢较量，下一盘继续。'] : ['这盘我赢了，谢谢你认真下完。期待再来一盘。'];
    }
    this.recent = this.recent.filter(line=>event.ply-line.ply<24);
    const text = choices.find(line=>!this.recent.some(previous=>previous.text===line));
    if (!text) return null;
    this.recent = [...this.recent,{text,ply:event.ply}].slice(-8);
    if (event.actor === 'player' && event.kind === 'blunder' && character === 'victor') manager.memories.push({kind:'taunt',ply:event.ply});
    if (event.actor === 'player' && event.kind === 'brilliant') manager.memories.push({kind:'respect',ply:event.ply});
    manager.memories = manager.memories.slice(-6);
    return text;
  }
}
