import mongoose from "mongoose";

export interface ITool {
  name: string;
  description?: string;
  inputSchema: any;
  annotations?: any;
  handler: {
    type: string;
    config: any;
  };
  creator: string; // user email or 'system'
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  rolesPermitted?: string[];
  alwaysVisible?: boolean;
}

const toolSchema = new mongoose.Schema<ITool>(
  {
    name: { type: String, required: true },
    description: { type: String },
    inputSchema: { type: Object, required: true },
    annotations: { type: Object },
    handler: {
      type: { type: String, required: true },
      config: { type: Object, required: true },
    },
    creator: { type: String, required: true },
    lastUsed: { type: Date },
    rolesPermitted: [{ type: String }],
    alwaysVisible: { type: Boolean },
  },
  { timestamps: true },
);

// Compound unique index on (name, creator) instead of global name uniqueness
toolSchema.index({ name: 1, creator: 1 }, { unique: true });

// Virtual field for namespaced name
toolSchema.virtual("namespacedName").get(function (this: any) {
  return `${this.creator}:${this.name}`;
});

toolSchema.virtual("id").get(function (this: any) {
  return this._id.toString();
});

export const Tool = mongoose.model<ITool>("Tool", toolSchema);
