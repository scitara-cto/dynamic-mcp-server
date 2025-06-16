import mongoose from "mongoose";
import { PromptArgumentDefinition } from "../../mcp/types.js";

export interface IPrompt {
  name: string;
  description?: string;
  arguments?: PromptArgumentDefinition[];
  handler: {
    type: string;
    config: any;
  };
  createdBy: string; // user email or 'system'
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  rolesPermitted?: string[];
  alwaysVisible?: boolean;
}

const promptArgumentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  required: { type: Boolean, default: false },
}, { _id: false });

const promptSchema = new mongoose.Schema<IPrompt>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    arguments: [promptArgumentSchema],
    handler: {
      type: { type: String, required: true },
      config: { type: Object, required: true },
    },
    createdBy: { type: String, required: true },
    lastUsed: { type: Date },
    rolesPermitted: [{ type: String }],
    alwaysVisible: { type: Boolean },
  },
  { timestamps: true },
);

promptSchema.virtual("id").get(function (this: any) {
  return this._id.toString();
});

export const Prompt = mongoose.model<IPrompt>("Prompt", promptSchema);