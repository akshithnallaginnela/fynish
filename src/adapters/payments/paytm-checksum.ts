import crypto from "crypto";

const IV = "@@@@&&&&####$$$$";

export class PaytmChecksum {
  static encrypt(input: string, key: string): string {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
    let encrypted = cipher.update(input, "binary", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }

  static decrypt(encrypted: string, key: string): string {
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, IV);
    let decrypted = decipher.update(encrypted, "base64", "binary");
    decrypted += decipher.final("binary");
    return decrypted;
  }

  static async generateRandomString(length: number): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes((length * 3.0) / 4.0, (err, buf) => {
        if (err) reject(err);
        else resolve(buf.toString("base64"));
      });
    });
  }

  static calculateHash(params: string, salt: string): string {
    const finalString = `${params}|${salt}`;
    return crypto.createHash("sha256").update(finalString).digest("hex") + salt;
  }

  static calculateChecksum(params: string, key: string, salt: string): string {
    const hashString = this.calculateHash(params, salt);
    return this.encrypt(hashString, key);
  }

  static async generateSignatureByString(params: string, key: string): Promise<string> {
    const salt = await this.generateRandomString(4);
    return this.calculateChecksum(params, key, salt);
  }

  static verifySignatureByString(params: string, key: string, checksum: string): boolean {
    try {
      const paytmHash = this.decrypt(checksum, key);
      const salt = paytmHash.substring(paytmHash.length - 4);
      const calculatedHash = this.calculateHash(params, salt);
      return paytmHash === calculatedHash;
    } catch {
      return false;
    }
  }

  static async generateSignature(params: string | Record<string, unknown>, key: string): Promise<string> {
    const paramString = typeof params === "string" ? params : this.getStringByParams(params);
    return this.generateSignatureByString(paramString, key);
  }

  static verifySignature(params: string | Record<string, unknown>, key: string, checksum: string): boolean {
    const paramString = typeof params === "string" ? params : this.getStringByParams(params);
    return this.verifySignatureByString(paramString, key, checksum);
  }

  static getStringByParams(params: Record<string, unknown>): string {
    const data: Record<string, unknown> = {};
    Object.keys(params)
      .sort()
      .forEach((key) => {
        data[key] = params[key] !== null && params[key] !== undefined && params[key] !== "null" ? params[key] : "";
      });
    return Object.values(data).join("|");
  }
}
