import mongoose, { Schema } from "mongoose";

// Below schema is used to define the structure of the user document in the MongoDB database. It includes fields for name, username, password and token. The username field is unique and required, while the other fields are also required.
const userScheme = new Schema(
    {
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        token: { type: String }
    }
)

const User = mongoose.model("User", userScheme);

export { User };