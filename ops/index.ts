// Ops are registered via side-effect imports.
// Each op file calls registerOp() at module load.
import "./addMiddleware";
import "./addCaching";
import "./wrapTransformation";
import "./extractModule";

export { applicableOps, getOp, listOps } from "./registry";
export type {
  Op,
  GraphTarget,
  OpApplyResult,
  OpDescriptor,
  OpGraphPatch,
} from "./types";
export { describeOp } from "./types";
