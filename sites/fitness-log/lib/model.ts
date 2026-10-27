import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}, '请输入有效日期');
const optionalNumber = (min: number, max: number) => z.number().finite().min(min).max(max).nullable();
const timedTarget = z.number().int().min(1).max(86_400).nullable();
export const rpeSchema = z.number().finite().min(0).max(10).multipleOf(0.5,'RPE 请填写 0–10 之间的 0.5 刻度').nullable();
export const setComponentSchema = z.object({
  exercise: z.string().trim().min(1).max(100), weight: optionalNumber(0,1500),
  reps: z.number().int().min(1).max(1000).nullable(),
  durationSeconds: timedTarget,
  durationMaxSeconds: timedTarget.optional(),
  mcv: optionalNumber(0,20).optional(),
}).strict().superRefine((v,ctx)=>{
  if(v.reps===null && v.durationSeconds===null)ctx.addIssue({code:'custom',message:'组合动作需填写次数或时间'});
  if(v.durationMaxSeconds!==undefined && v.durationMaxSeconds!==null && (v.durationSeconds===null || v.durationMaxSeconds<v.durationSeconds))ctx.addIssue({code:'custom',message:'时间上限不能小于下限'});
});
export const profileIdSchema = z.union([z.literal('self'), z.string().uuid()]);
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80), birthDate: dateSchema.nullable(),
  sex: z.enum(['female', 'male', 'other']).nullable(), heightCm: optionalNumber(50, 300),
  notes: z.string().max(1000),
}).strict();
export const setSchema = z.object({
  id: z.string().uuid(), groupId: z.string().uuid().optional(), exercise: z.string().trim().min(1).max(100),
  muscle: z.enum(['胸部', '背部', '腿部', '肩部', '手臂', '核心', '全身', '有氧']),
  weight: z.number().finite().min(0).max(1500), reps: z.number().int().min(1).max(1000).nullable(),
  durationSeconds: timedTarget.optional(), durationMaxSeconds: timedTarget.optional(),
  restSeconds: timedTarget.optional(), restMaxSeconds: timedTarget.optional(),
  mcv: optionalNumber(0,20).optional(),
  components: z.array(setComponentSchema).min(2).max(10).optional(), notes: z.string().max(500).optional(),
  rpe: rpeSchema, completed: z.boolean(), warmup: z.boolean(),
}).strict().superRefine((v,ctx)=>{
  if(!v.components?.length && v.reps===null && (v.durationSeconds===undefined || v.durationSeconds===null))ctx.addIssue({code:'custom',message:'每组至少填写次数或时间'});
  if(v.components?.length && (v.reps!==null || (v.durationSeconds!==undefined && v.durationSeconds!==null)))ctx.addIssue({code:'custom',message:'组合动作的次数和时间请填写在子动作中'});
  if(v.durationMaxSeconds!==undefined && v.durationMaxSeconds!==null && (v.durationSeconds===undefined || v.durationSeconds===null || v.durationMaxSeconds<v.durationSeconds))ctx.addIssue({code:'custom',message:'时间上限不能小于下限'});
  if(v.restMaxSeconds!==undefined && v.restMaxSeconds!==null && (v.restSeconds===undefined || v.restSeconds===null || v.restMaxSeconds<v.restSeconds))ctx.addIssue({code:'custom',message:'休息上限不能小于下限'});
});
export const workoutSchema = z.object({
  profileId: profileIdSchema.optional(),
  name: z.string().trim().min(1).max(100), date: dateSchema,
  durationMinutes: optionalNumber(1, 1440), calories: optionalNumber(0, 20000),
  calorieSource: z.enum(['manual', 'device']).nullable(),
  feeling: z.number().int().min(1).max(5).nullable(),
  status: z.enum(['draft', 'completed']), notes: z.string().max(4000),
  sets: z.array(setSchema).min(1).max(300),
}).strict().superRefine((v, ctx) => {
  if ((v.calories === null) !== (v.calorieSource === null)) ctx.addIssue({code:'custom', message:'热量与数据来源必须同时填写或同时留空', path:['calories']});
  if (new Set(v.sets.map(s => s.id)).size !== v.sets.length) ctx.addIssue({code:'custom', message:'组 ID 不能重复', path:['sets']});
  if (v.status === 'completed' && !v.sets.some(s => s.completed)) ctx.addIssue({code:'custom', message:'至少完成一组后才能结束训练', path:['sets']});
});
export const planSchema = z.object({
  profileId: profileIdSchema.optional(),
  name: z.string().trim().min(1).max(100), description: z.string().max(2000),
  sets: z.array(setSchema).min(1).max(300),
}).strict();
export const metricSchema = z.object({
  profileId: profileIdSchema.optional(),
  date: dateSchema, weight: optionalNumber(10, 500), bodyFat: optionalNumber(1, 75),
  restingHeartRate: optionalNumber(20, 250), source: z.enum(['manual', 'device']), notes: z.string().max(2000),
}).strict().refine(v => [v.weight, v.bodyFat, v.restingHeartRate].some(n => n !== null), '至少填写一个身体指标');
export type TrainingSet = z.infer<typeof setSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type MetricInput = z.infer<typeof metricSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type Via = 'web' | 'mcp';
export type Metadata = { id: string; createdAt: string; updatedAt: string; createdVia: Via; updatedVia: Via };
export type Workout = WorkoutInput & Metadata;
export type Plan = PlanInput & Metadata;
export type Metric = MetricInput & Metadata;
export type Profile = ProfileInput & Metadata;
export type Kind = 'workout' | 'plan' | 'metric';
export type Snapshot = { schemaVersion: 4; exportedAt: string; timezone: 'Asia/Shanghai'; profiles: Profile[]; workouts: Workout[]; plans: Plan[]; metrics: Metric[] };
export const schemas = {workout: workoutSchema, plan: planSchema, metric: metricSchema};
export const mutationSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('profile'),id:profileIdSchema.optional(),data:z.unknown()}).strict(),
  z.object({kind:z.enum(['workout','plan','metric']),id:z.string().uuid().optional(),data:z.unknown(),expectedUpdatedAt:z.string().datetime().optional()}).strict(),
]).superRefine((v,ctx)=>{if(v.kind!=='profile' && v.id && !v.expectedUpdatedAt)ctx.addIssue({code:'custom',path:['expectedUpdatedAt'],message:'编辑记录需要原始版本'});});
export const deleteSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('profile'),id:z.string().uuid()}).strict(),
  z.object({kind:z.enum(['workout','plan','metric']),id:z.string().uuid()}).strict(),
]);
export function localDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).format(now); }
export function emptySet(): TrainingSet { return {id:crypto.randomUUID(), groupId:crypto.randomUUID(), exercise:'', muscle:'胸部', weight:0, reps:10, durationSeconds:null,restSeconds:null,mcv:null,rpe:null, completed:false, warmup:false}; }
export function emptyWorkout(date = localDate()): WorkoutInput { return {name:'力量训练', date, durationMinutes:null, calories:null, calorieSource:null, feeling:null, status:'draft', notes:'', sets:[emptySet()]}; }
