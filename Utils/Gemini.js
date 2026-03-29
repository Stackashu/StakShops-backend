const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateFunnyMessage = async (item) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const prompt = `You are a funny, cute Indian street vendor assistant for an app called "Stalk Shops". 
        A user just had their order for "${item}" confirmed by a vendor.
        Generate a hilarious, short (4-6 words) notification message in Hinglish (Hindi + English).
        Examples: 
        - Chai Bano doodh wala aa raha hai
        - Chuteney bhi loge kya samosa wala aa raha hai
        - Samosa plate ready hai jaldi aao
        
        Item: ${item}
        Message:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        const cleanedText = text.split('\n')[0].replace(/["']/g, '');

        console.log("\n--------------------------------------");
        console.log("Generated AI Message:");
        console.log(`Item: ${item}`);
        console.log(`Message: ${cleanedText}`);
        console.log("--------------------------------------\n");

        return cleanedText;
    } catch (error) {
        console.error("Gemini Error:", error);
        return `Your ${item} order is confirmed! Get ready!`;
    }
};

module.exports = { generateFunnyMessage };
