import mongoose from "mongoose";

export interface IUser {
  email: string; // Primary identifier
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  roles?: string[];
  allowedTools?: string[];
  sharedTools: {
    toolId: string;
    sharedBy: string;
    accessLevel: "read" | "write";
    sharedAt: Date;
  }[];
}

const userSchema = new mongoose.Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String },
    roles: [{ type: String }],
    allowedTools: [{ type: String }],
    sharedTools: [
      {
        toolId: { type: String, required: true },
        sharedBy: { type: String, required: true },
        accessLevel: { type: String, enum: ["read", "write"], default: "read" },
        sharedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Add a virtual 'id' field that maps to '_id'
userSchema.virtual("id").get(function (this: any) {
  return this._id.toString();
});

// Ensure virtuals are included in toJSON and toObject
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

export const User = mongoose.model<IUser>("User", userSchema);
