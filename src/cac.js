require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { QuickDB } = require('quick.db');
const { MongoDriver } = require('quickmongo');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const transactionFilePath = path.join(__dirname, 'transactions.json');

function saveTransaction(data) {
    try {
        let transactions = [];

        // Check if the file exists
        if (fs.existsSync(transactionFilePath)) {
            const fileData = fs.readFileSync(transactionFilePath, 'utf-8');

            // If file is not empty, parse its content, else start with an empty array
            if (fileData.trim()) {
                try {
                    transactions = JSON.parse(fileData);
                } catch (error) {
                    console.error('Error parsing JSON file:', error);
                    transactions = []; // Start fresh if the file is corrupted
                }
            }
        }

        // Add the new transaction data
        transactions.push(data);

        // Write the updated transactions array back to the file
        fs.writeFileSync(transactionFilePath, JSON.stringify(transactions, null, 2));
        console.log('Transaction saved successfully.');
    } catch (error) {
        console.error('Error saving transaction:', error);
    }
}

const port = process.env.PORT || 3000;
const adminIds = [process.env.ADMIN_ID_1, process.env.ADMIN_ID_2, process.env.ADMIN_ID_3];

const driver = new MongoDriver(process.env.MONGO_URI);

const connectToDatabase = async () => {
    try {
        console.log('Connected to MongoDB');
        bot.DB = new QuickDB();
        bot.User = bot.DB.table('Koy');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session({
    getSessionKey: (ctx) => ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`
}));

bot.use(async (ctx, next) => {
    ctx.session ??= {};
    await next();
});

bot.use(async (ctx, next) => {
    ctx.session ??= {};
    ctx.session.messageIds ??= [];  // Store message IDs here
    await next();
});

async function deletePreviousMessages(ctx) {
    const messageIds = ctx.session.messageIds || [];

    for (const messageId of messageIds) {
        try {
            await ctx.deleteMessage(messageId);  // Delete each message by ID
        } catch (err) {
            console.error('Failed to delete message:', err);  // Log errors without breaking the loop
        }
    }

    // Clear the message ID list after deletion
    ctx.session.messageIds = [];
}

const companySections = [
    {
        instruction: '(1/9) COMPANY NAME DETAILS\nPlease provide your company name(s).',
        key: 'company_name_instruction',
        questions: [
            { text: 'Please provide your company name 1:', key: 'company_name_1', type: 'text' },
            { text: 'Please provide your company name 2:', key: 'company_name_2', type: 'text' },
            { text: 'Please provide your company name 3:', key: 'company_name_3', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Company Name 1: ${ctx.session.answers.company_name_1}\n` +
                    `Company Name 2: ${ctx.session.answers.company_name_2}\n` +
                    `Company Name 3: ${ctx.session.answers.company_name_3}\n\nIs that correct?`,
                key: 'company_names_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(2/8) YOUR BUSINESS ADDRESS:',
        key: 'business_address_instruction',
        questions: [
            { text: 'Please provide your business Residential Address (STATE OF RESIDENCE):', key: 'business_state', type: 'text' },
            { text: 'Please provide your business Local Government Area:', key: 'business_lga', type: 'text' },
            { text: 'Please provide your business City:', key: 'business_city', type: 'text' },
            { text: 'Please provide your business House number:', key: 'business_house_number', type: 'text' },
            { text: 'Please provide your business Street name:', key: 'business_street', type: 'text' },
            { text: 'What is the Nature of Business? (as many as possible):', key: 'business_nature', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Business Address:\n` +
                    `● State: ${ctx.session.answers.business_state}\n` +
                    `● LGA: ${ctx.session.answers.business_lga}\n` +
                    `● City/Town/Village: ${ctx.session.answers.business_city}\n` +
                    `● House Number: ${ctx.session.answers.business_house_number}\n` +
                    `● Street Name: ${ctx.session.answers.business_street}\n\n` +
                    `● Nature of Business: ${ctx.session.answers.business_nature}\n\nIs that correct?`,
                key: 'residential_address_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    // {
    //     instruction: 'DIRECTOR COUNT \n\nQUEST: How many directors does your company have?',
    //     key: 'director_count',
    //     questions: [
    //         {
    //             text: 'Please select how many directors your company has:',
    //             key: 'number_of_directors',
    //             type: 'number_selection',
    //             options: [
    //                 { text: '1', callback_data: 'directors_1' },
    //                 { text: '2', callback_data: 'directors_2' },
    //                 { text: '3+', callback_data: 'directors_3plus' }
    //             ]
    //         }
    //     ]
    // },
    {
        instruction: '(3/8) DIRECTOR INFORMATION \n\nQUEST: Who is a director? \n\nANS: Directors are people who carry out the day-to-day running of company activities. \n\nKindly fill the form twice if there are more than 1 director(s)',
        key: 'personal_details_instruction',
        questions: [
            { text: 'Please provide your director Last name:', key: 'last_name', type: 'text' },
            { text: 'Please provide your director First name:', key: 'first_name', type: 'text' },
            { text: 'Please provide director Last names:', key: 'other_names', type: 'text' },
            { text: 'Please provide your director Data Of Birth:', key: 'dob', type: 'text' },
            { text: 'Please provide your director Gender:', key: 'gender', type: 'text' },
            { text: 'Please provide your director Phone number:', key: 'mobile', type: 'text' },
            { text: 'Please provide your director Personal email:', key: 'personal_email', type: 'text' },
            { text: 'Please provide your director Residential Address (STATE OF RESIDENCE):', key: 'Sot', type: 'text' },
            { text: 'Please provide your director Local Government Area:', key: 'personal_lga', type: 'text' },
            { text: 'Please provide your director City:', key: 'personal_city', type: 'text' },
            { text: 'Please provide your director House number:', key: 'personal_house_no', type: 'text' },
            { text: 'Please provide your director Street name:', key: 'personal_street', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `DIRECTOR INFORMATION:\n` +
                    `● Surname: ${ctx.session.answers.last_name}\n` +
                    `● First name: ${ctx.session.answers.first_name}\n` +
                    `● Last names: ${ctx.session.answers.other_names}\n` +
                    `● Date Of Birth: ${ctx.session.answers.dob}\n` +
                    `● Gender: ${ctx.session.answers.gender}\n` +
                    `● Phone number: ${ctx.session.answers.mobile}\n` +
                    `● Personal email: ${ctx.session.answers.personal_email}\n\n` +
                    `● State: ${ctx.session.answers.personal_Sot}\n` +
                    `● LGA: ${ctx.session.answers.personal_lga}\n` +
                    `● City/Town/Village: ${ctx.session.answers.personal_city}\n` +
                    `● House Number: ${ctx.session.answers.personal_house_no}\n` +
                    `● Street Name: ${ctx.session.answers.personal_street}\n\n Is that correct?`,
                key: 'personal_details_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(4/8) DIRECTOR’S IDENTIFICATION (A):\n\nplease upload a clear photo of your Director\'s ID respectively',
        key: 'DIRECTOR’S IDENTIFICATION (A):',
        questions: [
            { text: '● Please Upload a clear valid means of ID (NIN Slip, Voters Card, Driver’s license, International passport e.t.c):', key: 'directors_id', type: 'photo' },
        ]
    },
    {
        instruction: '(4/8) DIRECTOR’S IDENTIFICATION (B):\n\nplease upload a clear photo of your Director\'s signature respectively',
        key: 'DIRECTOR’S IDENTIFICATION (B):',
        questions: [
            { text: '● Please Upload your Signature\n\n(Hint: you can sign on a paper and take a photo:', key: 'directors_id_B', type: 'photo' },
        ]
    },
    {
        instruction: '(5/8) Before you fill in the shareholder\'s information \n\nQUEST: Who is a shareholder? \n\nANS: Shareholders are people who own the business/company. \n\nQUEST: Can I be the shareholder and director \n\nANS: Yes, if you are the only person involved in the business then you are a shareholder and director',
        key: 'shareholders_details_instruction',
        questions: [
            { text: 'Please provide shareholder\'s Last name:', key: 'shareholders_last_name', type: 'text' },
            { text: 'Please provide shareholder\'s First name:', key: 'shareholders_first_name', type: 'text' },
            { text: 'Please provide shareholder\'s Last names:', key: 'shareholders_other_names', type: 'text' },
            { text: 'Please provide shareholder\'s Data Of Birth:', key: 'shareholders_dob', type: 'text' },
            { text: 'Please provide shareholder\'s Gender:', key: 'shareholders_gender', type: 'text' },
            { text: 'Please provide shareholder\'s Phone number:', key: 'shareholders_mobile', type: 'text' },
            { text: 'Please provide shareholder\'s Personal email:', key: 'shareholders_personal_email', type: 'text' },
            { text: 'Please provide shareholder\'s Residential Address (STATE OF RESIDENCE):', key: 'shareholders_Sot', type: 'text' },
            { text: 'Please provide shareholder\'s Local Government Area:', key: 'shareholders_personal_lga', type: 'text' },
            { text: 'Please provide shareholder\'s City:', key: 'shareholders_personal_city', type: 'text' },
            { text: 'Please provide shareholder\'s House number:', key: 'shareholders_personal_house_no', type: 'text' },
            { text: 'Please provide shareholder\'s Street name:', key: 'shareholders_personal_street', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Shareholder\'s Information:\n` +
                    `● Surname: ${ctx.session.answers.shareholders_last_name}\n` +
                    `● First name: ${ctx.session.answers.shareholders_first_name}\n` +
                    `● Last names: ${ctx.session.answers.shareholders_other_names}\n` +
                    `● Date Of Birth: ${ctx.session.answers.shareholders_dob}\n` +
                    `● Gender: ${ctx.session.answers.shareholders_gender}\n` +
                    `● Phone number: ${ctx.session.answers.shareholders_mobile}\n` +
                    `● Personal email: ${ctx.session.answers.shareholders_personal_email}\n\n` +
                    `● State: ${ctx.session.answers.shareholders_personal_Sot}\n` +
                    `● LGA: ${ctx.session.answers.shareholders_personal_lga}\n` +
                    `● City/Town/Village: ${ctx.session.answers.shareholders_personal_city}\n` +
                    `● House Number: ${ctx.session.answers.shareholders_personal_house_no}\n` +
                    `● Street Name: ${ctx.session.answers.shareholders_personal_street}\n\n Is that correct?`,
                key: 'personal_details_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(6/8) SHAREHOLDER’S IDENTIFICATION (A):\n\nplease upload a clear photo of your shareholder\'s ID respectively',
        key: 'SHAREHOLDER’S IDENTIFICATION (A):',
        questions: [
            { text: '● Please Upload a clear valid means of the Shareholder’s ID (NIN Slip, Voters Card, Driver’s license, International passport e.t.c):', key: 'shareholders_signature_id_A', type: 'photo' },
        ]
    },
    {
        instruction: '(6/8) SHAREHOLDER’S IDENTIFICATION (B):\n\nplease upload a clear photo of your shareholder\'s signature respectively',
        key: 'SHAREHOLDER’S IDENTIFICATION (B):',
        questions: [
            { text: '● Please Upload the Shareholder\'s Signature\n\n(Hint: you can sign on a paper and take a photo:', key: 'shareholders_signature_id_B', type: 'photo' },
        ]
    },
    {
        instruction: '(7/8) WITNESS INFORMATION\nBefore you fill out the next form for which is the Witness\n\nCan I be a Witness?\n\nNo. A witness is a neutral person from your business, it could be a family or friend. They can’t be a director or shareholder.',
        key: 'witness_information_instruction',
        questions: [
            { text: 'Please provide Witness Surname:', key: 'witness_surname', type: 'text' },
            { text: 'Please provide Witness First Name:', key: 'witness_first_name', type: 'text' },
            { text: 'Please provide Witness Last Name:', key: 'witness_other_name', type: 'text' },
            { text: 'Please provide Witness Phone Number:', key: 'witness_phone_number', type: 'text' },
            { text: 'Please provide Witness Email:', key: 'witness_email', type: 'text' },
            { text: 'Please provide Witness Occupation:', key: 'witness_occupation', type: 'text' },
            { text: 'Please provide Witness Residential State:', key: 'witness_state', type: 'text' },
            { text: 'Please provide Witness LGA:', key: 'witness_lga', type: 'text' },
            { text: 'Please provide Witness City/Town/Village:', key: 'witness_city', type: 'text' },
            { text: 'Please provide Witness House Number:', key: 'witness_house_number', type: 'text' },
            { text: 'Please provide Witness Street Name:', key: 'witness_street', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Witness Information:\n` +
                    `Surname: ${ctx.session.answers.witness_surname}\n` +
                    `First Name: ${ctx.session.answers.witness_first_name}\n` +
                    `Last Name: ${ctx.session.answers.witness_other_name}\n` +
                    `Phone Number: ${ctx.session.answers.witness_phone_number}\n` +
                    `Email: ${ctx.session.answers.witness_email}\n` +
                    `Occupation: ${ctx.session.answers.witness_occupation}\n` +
                    `State: ${ctx.session.answers.witness_state}\n` +
                    `LGA: ${ctx.session.answers.witness_lga}\n` +
                    `City/Town/Village: ${ctx.session.answers.witness_city}\n` +
                    `House Number: ${ctx.session.answers.witness_house_number}\n` +
                    `Street Name: ${ctx.session.answers.witness_street}\n\nIs that correct?`,
                key: 'witness_information_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(8/8) WITNESS SIGNATURE (B):\n\nplease upload a clear signature respectively',
        key: 'WITNESS SIGNATURE (B):',
        questions: [
            { text: '● Please Upload the Witness Signature\n\n(Hint: you can sign on a paper and take a photo:', key: 'witness_id_B', type: 'photo' },
        ]
    },
];

const businessSections = [
    {
        instruction: '(1/9) BUSINESS NAME DETAILS\nPlease provide multiple business names in case any have been taken by someone else.',
        key: 'business_name_instruction',
        questions: [
            { text: 'Please provide your business name 1:', key: 'business_name_1', type: 'text' },
            { text: 'Please provide your business name 2:', key: 'business_name_2', type: 'text' },
            { text: 'Please provide your business name 3:', key: 'business_name_3', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Business Name 1: ${ctx.session.answers.business_name_1}\n` +
                    `Business Name 2: ${ctx.session.answers.business_name_2}\n` +
                    `Business Name 3: ${ctx.session.answers.business_name_3}\n\nIs that correct?`,
                key: 'business_names_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(2/9) YOUR PERSONAL DETAILS\nPlease provide your personal details...',
        key: 'personal_details_instruction',
        questions: [
            { text: 'Please provide your Last name:', key: 'last_name', type: 'text' },
            { text: 'Please provide your First name:', key: 'first_name', type: 'text' },
            { text: 'Please provide Other names:', key: 'other_names', type: 'text' },
            { text: 'Please provide your Data Of Birth:', key: 'dob', type: 'text' },
            { text: 'Please provide your Gender:', key: 'gender', type: 'text' },
            { text: 'Please provide your Phone number:', key: 'mobile', type: 'text' },
            { text: 'Please provide your Personal email:', key: 'personal_email', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Personal Information:\n` +
                    `● Surname: ${ctx.session.answers.last_name}\n` +
                    `● First name: ${ctx.session.answers.first_name}\n` +
                    `● Other names: ${ctx.session.answers.other_names}\n` +
                    `● Date Of Birth: ${ctx.session.answers.dob}\n` +
                    `● Gender: ${ctx.session.answers.gender}\n` +
                    `● Phone number: ${ctx.session.answers.mobile}\n` +
                    `● Personal email: ${ctx.session.answers.personal_email}\n\nIs that correct?`,
                key: 'personal_details_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(3/9) RESIDENTIAL ADDRESS\nPlease provide your residential address.',
        key: 'residential_address_instruction',
        questions: [
            { text: 'Please provide your Residential Address (STATE OF RESIDENCE):', key: 'residential_state', type: 'text' },
            { text: 'Please provide your Local Government Area:', key: 'residential_lga', type: 'text' },
            { text: 'Please provide your City:', key: 'residential_city', type: 'text' },
            { text: 'Please provide your House number:', key: 'residential_house_number', type: 'text' },
            { text: 'Please provide your Street name:', key: 'residential_street', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `Residential Address:\n` +
                    `● State: ${ctx.session.answers.residential_state}\n` +
                    `● LGA: ${ctx.session.answers.residential_lga}\n` +
                    `● City/Town/Village: ${ctx.session.answers.residential_city}\n` +
                    `● House Number: ${ctx.session.answers.residential_house_number}\n` +
                    `● Street Name: ${ctx.session.answers.residential_street}\n\nIs that correct?`,
                key: 'residential_address_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(4/9) YOUR BUSINESS ADDRESS',
        key: 'business_address_business_instruction',
        questions: [
            { text: 'Please provide your business Residential Address (STATE OF RESIDENCE):', key: 'business_address_state', type: 'text' },
            { text: 'Please provide your business Local Government Area:', key: 'business_address_lga', type: 'text' },
            { text: 'Please provide your business City:', key: 'business_address_city', type: 'text' },
            { text: 'Please provide your business House number:', key: 'business_address_house_number', type: 'text' },
            { text: 'Please provide your business Street name:', key: 'business_address_street', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `● State: \n${ctx.session.answers.business_address_state}\n` +
                    `● LGA: \n${ctx.session.answers.business_address_lga}\n` +
                    `● City: \n${ctx.session.answers.business_address_city}\n` +
                    `● House Number: \n${ctx.session.answers.business_address_house_number}\n` +
                    `● Street Name: \n${ctx.session.answers.business_address_street}\n\nIs that correct?`,
                key: 'business_address_address_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(5/9) Nature of Business',
        key: 'nature_of_business_instruction',
        questions: [
            { text: 'Tell us what your business does. :', key: 'nature_of_business', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `● Nature Of Business: \n\n${ctx.session.answers.nature_of_business}\n\nIs that correct?`,
                key: 'residential_address_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(6/9) Provide a your business functional email in this section',
        key: 'nature_of_business_instruction',
        questions: [
            { text: '(6/9) ●Functional Business Email:', key: 'business_email', type: 'text' },
            {
                confirmationText: (ctx) =>
                    `● Functional Business Email: ${ctx.session.answers.business_email}\n\nIs that correct?`,
                key: 'residential_address_confirmation',
                type: 'confirmation',
                confirmation_buttons: [
                    { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
                    { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
                ]
            }
        ]
    },
    {
        instruction: '(7/9) BUSINESS OWNER IDENTIFICATION :\n\nPlease Upload a clear valid means of the Business owner\'s ID (NIN Slip, Voters Card, Driver’s license, International passport e.t.c)',
        key: 'BUSINESS OWNER IDENTIFICATION',
        questions: [
            { text: '● Please Upload a clear valid means of the Business owner\'s ID (NIN Slip, Voters Card, Driver’s license, International passport e.t.c):', key: 'photo_id', type: 'photo' },
        ]
    },
    {
        instruction: '(8/9) BUSINESS OWNER SIGNATURE\n\nplease upload a clear signature respectively.',
        key: 'BUSINESS OWNER SIGNATURE',
        questions: [
            { text: '● Please Upload your Signature \n\n(Hint: you can sign on a paper and take a photo):', key: 'signature_id', type: 'photo' },
        ]
    },
    {
        instruction: '(9/9) BUSINESS OWNER PHOTO\n\nplease upload a clear passport photo respectively',
        key: 'BUSINESS OWNER SIGNATURE',
        questions: [
            { text: '● Please Upload a clear photo of passport photo respectively:', key: 'passport_id', type: 'photo' },
        ]
    }
];

async function sendSimultaneousMessages(ctx, messages) {
    const messagePromises = messages.map(async (message) => {
        try {
            if (message.type === 'text') {
                if (message.parse_mode === 'HTML') {
                    return await ctx.replyWithHTML(message.text); // Use HTML parsing when specified
                } else {
                    return await ctx.reply(message.text);
                }
            } else if (message.type === 'photo') {
                return await ctx.replyWithPhoto({ source: message.photoPath });
            }
        } catch (err) {
            
            console.error('Failed to send message:', err);
            return null;  // Return null if there was an error
        }
    });

    const sentMessages = await Promise.all(messagePromises);
    return sentMessages.filter(Boolean); // Ensure we return only successful messages
}

async function sendPaymentStatistics(ctx) {
    try {
        if (!fs.existsSync(transactionFilePath)) {
            return await ctx.reply('No transactions recorded yet.');
        }

        const transactions = JSON.parse(fs.readFileSync(transactionFilePath));

        const totalPayments = transactions.length;
        const companyPayments = transactions.filter(t => t.role === 'company').length;
        const businessPayments = transactions.filter(t => t.role === 'business').length;
        const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

        const message = `📊 <b>Payment Statistics</b>\n\n` +
                        `👥 <b>Total People Paid:</b> ${totalPayments}\n` +
                        `🏢 <b>Company Registrations:</b> ${companyPayments}\n` +
                        `🏬 <b>Business Registrations:</b> ${businessPayments}\n` +
                        `💰 <b>Total Amount Collected:</b> ₦${totalAmount}\n`;

        // Send the stats to the admin
        const adminId = process.env.ADMIN_ID;
        await ctx.telegram.sendMessage(ctx.from.id, message, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error fetching payment statistics:', error);
        await ctx.reply('An error occurred while retrieving payment statistics.');
    }
}

bot.command('stats', async (ctx) => {
    await sendPaymentStatistics(ctx);
});

bot.command('endchat', async (ctx) => {
    if (ctx.session.chattingWith) {
        const userId = ctx.session.chattingWith;
        ctx.session.chattingWith = null; // Clear the session
        await ctx.reply('The conversation has ended.');
        await bot.telegram.sendMessage(userId, 'The conversation with the admin has ended.');
    } else {
        await ctx.reply('No active conversation.');
    }
});

bot.command('start', async (ctx) => {
    const adminId = process.env.ADMIN_ID;
    if (ctx.from.id.toString() === adminId) return;

    ctx.session.step = 0;
    ctx.session.answers = {};
    ctx.session.messageIds = []; // Store all sent message IDs to delete later

    const welcomeMessages = await sendSimultaneousMessages(ctx, [
        { type: 'text', text: `Thanks for reaching out to Legacy Benjamin Consult\n\nHow CAC Registration works\n\nIf your WhatsApp TV name ends with <b>TV</b>, you can ONLY register as a COMPANY.\n\nHowever, if it ends with <b>Media</b> or <b>Entertainment</b> or Any other name other than TV, kindly tick BUSINESS NAME.\n\n<b><a href="https://telegra.ph/CAC-FACTS-08-24">LEARN MORE ABOUT CAC REGISTRATION HERE</a></b>`, parse_mode: 'HTML' },
    ]);
    ctx.session.messageIds.push(...welcomeMessages.map(msg => msg.message_id)); // Track message IDs

    const selectCategoryMessage = await ctx.reply(`Kindly select the category of registration⤵️\n\nCompany N55,000\nBusiness Name N25,000`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '■ COMPANY', callback_data: 'company' }],
                [{ text: '■ BUSINESS', callback_data: 'business' }]
            ]
        }
    });
    ctx.session.messageIds.push(selectCategoryMessage.message_id); // Track the select category message ID
});

bot.hears('■ COMPANY', async (ctx) => {
 await ctx.replyWithHTML('<b>Kindly provide us with the following details;</b>\n\nMake sure all details are filled');
})

async function sendInstruction(ctx, section) {
    const message = await ctx.reply(section.instruction, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Proceed ➡️', callback_data: `begin_${section.key}` }] // Fixed string interpolation
            ]
        }
    });
    return message;  // Return the message object so it can be tracked
}

async function askNextQuestion(ctx) {
    await deletePreviousMessages(ctx);  // Delete previous messages

    const section = ctx.session.role === 'company' ? companySections[ctx.session.sectionIndex] : businessSections[ctx.session.sectionIndex];
    if (!section || !section.questions) {
        console.error('Invalid section or role:', ctx.session.role, ctx.session.sectionIndex);
        await ctx.reply('There seems to be an issue with the registration flow. Please restart the process.');
        return;
    }

    const step = ctx.session.step ?? 0;
    const questions = section.questions;

    // Handle director-related questions based on the number of directors
    const selectedDirectors = ctx.session.directorCount || 1;
    
    if (step >= questions.length) {
        if (ctx.session.currentDirectorIndex < selectedDirectors) {
            ctx.session.currentDirectorIndex += 1;
            ctx.session.step = 0;  // Reset to the first question for the next director
        } else {
            ctx.session.step = 0;
            ctx.session.sectionIndex += 1;

            if (ctx.session.sectionIndex >= (ctx.session.role === 'company' ? companySections.length : businessSections.length)) {
                const finalMessage = await ctx.reply('The registration process takes 5-15 days max.');
                await forwardAnswersAndInitiatePayment(ctx);
                return;
            }

            const instructionMessage = await sendInstruction(ctx, ctx.session.role === 'company' ? companySections[ctx.session.sectionIndex] : businessSections[ctx.session.sectionIndex]);
            ctx.session.messageIds.push(instructionMessage.message_id);
            return;
        }
    }

    const question = questions[step];

    // Repeat questions for each director
    if (ctx.session.currentDirectorIndex < selectedDirectors) {
        const directorNumber = ctx.session.currentDirectorIndex + 1;
        const messageText = `Please provide the details for Director #${directorNumber}: ${question.text}`;
        const sentMessage = await ctx.reply(messageText);
        ctx.session.messageIds.push(sentMessage.message_id);

        if (question.type === 'text') {
            ctx.session.answers[`${question.key}_director_${directorNumber}`] = ctx.message.text;
        }

        // Increment step to move to the next question
        ctx.session.step += 1;
        await askNextQuestion(ctx);
    }


    // const question = questions[step];
    if (question.type === 'confirmation') {
        const messageText = typeof question.confirmationText === 'function' ? question.confirmationText(ctx) : question.confirmationText;
        const sentMessage = await ctx.reply(messageText, {
            reply_markup: {
                inline_keyboard: question.confirmation_buttons.map(button => [{ text: button.text, callback_data: button.callback_data }])
            }
        });
        ctx.session.messageIds.push(sentMessage.message_id);  // Track the message ID
    } else {
        const messageText = typeof question.text === 'function' ? question.text(ctx.session.answers || {}) : question.text;
        const sentMessage = await ctx.reply(messageText);
        ctx.session.messageIds.push(sentMessage.message_id);  // Track the message ID
    }
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('directors_')) {
        ctx.session.step = 1;  // Move to the director detail question
        ctx.session.directorCount = data === 'directors_3plus' ? 3 : parseInt(data.split('_')[1], 10);
        ctx.session.currentDirectorIndex = 0;
        await askNextQuestion(ctx);
    }

    if (data.startsWith('verify_')) {
        const reference = data.split('_')[1];
        await ctx.reply('🔄 Verifying your payment...');
        await handleVerifyPayment(ctx, reference);
    }

    if (data.startsWith('startchat_')) {
        const userId = data.split('_')[1]; // Extract user ID from the callback data
        ctx.session.chattingWith = userId; // Set the admin's session to chat with this user
        await ctx.reply('You have started a conversation with the user. Type /endchat to stop the conversation.');
        await bot.telegram.sendMessage(userId, 'The admin has started a conversation with you. You can now chat directly.');
    }

    if (ctx.session.messageIds?.length) {
        for (const messageId of ctx.session.messageIds) {
            try {
                await ctx.deleteMessage(messageId);
            } catch (err) {
                console.error('Failed to delete message:', err);
            }
        }
        ctx.session.messageIds = []; // Clear the messageIds after deletion
    }

    if (data.startsWith('begin_')) {
        ctx.session.step = 0;
        await askNextQuestion(ctx);  // Ask the next question in the process
    } else if (data === 'company') {
        ctx.session.role = 'company';
        ctx.session.sectionIndex = 0;
        const instructionMessage = await sendInstruction(ctx, companySections[0]); // Send company section instructions
        ctx.session.messageIds.push(instructionMessage.message_id); // Track the instruction message ID
    } else if (data === 'business') {
        ctx.session.role = 'business';
        ctx.session.sectionIndex = 0;
        const instructionMessage = await sendInstruction(ctx, businessSections[0]); // Send business section instructions
        ctx.session.messageIds.push(instructionMessage.message_id); // Track the instruction message ID
    } else if (data === 'yes') {
        ctx.session.step += 1;
        await askNextQuestion(ctx);  // Move to the next question
    } else if (data === 'no') {
        ctx.session.step = 0;  // Re-ask the current section's questions
        await askNextQuestion(ctx);
    }
});

bot.on('message', async (ctx) => {
    const adminId = parseInt(process.env.ADMIN_ID, 10);  // Admin's ID from environment variables
    const isAdmin = ctx.from.id === adminId;  // Check if the sender is the admin
    const targetId = isAdmin ? ctx.session.chattingWith : adminId;  // Target ID is the other party in the chat

    // Check if the user is in an active conversation with the admin
    if (ctx.session.chattingWith) {
        // Ensure we have set the chattingWith session correctly for the user
        if (!isAdmin && !ctx.session.chattingWith) {
            ctx.session.chattingWith = adminId;  // Set chattingWith to admin's ID (only for users)
        }

        try {
            // Forward messages from the user to the admin
            if (!isAdmin) {
                // Forward user text messages to the admin
                if (ctx.message.text) {
                    await bot.telegram.sendMessage(adminId, `👤 <b>User Message:</b> ${ctx.message.text}`, { parse_mode: 'HTML' });
                }
                // Forward user photos to the admin
                if (ctx.message.photo) {
                    const photo = ctx.message.photo[ctx.message.photo.length - 1];  // Get the highest resolution photo
                    await bot.telegram.sendPhoto(adminId, photo.file_id, { caption: ctx.message.caption || 'Photo from user' });
                }
                // Forward user stickers to the admin
                if (ctx.message.sticker) {
                    await bot.telegram.sendSticker(adminId, ctx.message.sticker.file_id);
                }
                // Forward user audio messages to the admin
                if (ctx.message.audio) {
                    await bot.telegram.sendAudio(adminId, ctx.message.audio.file_id);
                }
                // Forward user voice messages to the admin
                if (ctx.message.voice) {
                    await bot.telegram.sendVoice(adminId, ctx.message.voice.file_id);
                }
            }

            // Forward messages from the admin to the user
            if (isAdmin) {
                // Forward admin text messages to the user
                if (ctx.message.text) {
                    await bot.telegram.sendMessage(targetId, `👤 <b>Admin Message:</b> ${ctx.message.text}`, { parse_mode: 'HTML' });
                }
                // Forward admin photos to the user
                if (ctx.message.photo) {
                    const photo = ctx.message.photo[ctx.message.photo.length - 1];  // Get the highest resolution photo
                    await bot.telegram.sendPhoto(targetId, photo.file_id, { caption: ctx.message.caption || 'Photo from admin' });
                }
                // Forward admin stickers to the user
                if (ctx.message.sticker) {
                    await bot.telegram.sendSticker(targetId, ctx.message.sticker.file_id);
                }
                // Forward admin audio messages to the user
                if (ctx.message.audio) {
                    await bot.telegram.sendAudio(targetId, ctx.message.audio.file_id);
                }
                // Forward admin voice messages to the user
                if (ctx.message.voice) {
                    await bot.telegram.sendVoice(targetId, ctx.message.voice.file_id);
                }
            }

            return;  // Exit the function to prevent further registration logic execution during chat
        } catch (error) {
            console.error('Error forwarding message between admin and user:', error);
            await ctx.reply('An error occurred while forwarding the message. Please try again.');
            return;
        }
    }

    // If no active chat, handle the registration process
    if (!ctx.session.chattingWith) {
        // If not in an active chat, handle the registration process
        if (!ctx.session.role || ctx.session.sectionIndex === undefined) {
            await ctx.reply('An error occurred. Please restart the registration process.');
            return;
        }

        const section = ctx.session.role === 'company' ? companySections[ctx.session.sectionIndex] : businessSections[ctx.session.sectionIndex];

        if (!section || !section.questions || !section.questions[ctx.session.step]) {
            await ctx.reply('An error occurred. Please restart the registration process.');
            return;
        }

        const question = section.questions[ctx.session.step];

        // Handle text-based questions
        if (question.type === 'text') {
            ctx.session.answers[question.key] = ctx.message.text;

            if (ctx.session.messageId) {
                try {
                    await ctx.deleteMessage(ctx.session.messageId);
                } catch (err) {
                    console.error('Failed to delete message:', err);
                }
            }

            ctx.session.step += 1;
            await askNextQuestion(ctx);

        // Handle photo-based questions
        } else if (question.type === 'photo') {
            if (!ctx.message.photo) {  // Ensure the user sends a valid photo
                await ctx.reply('Please upload a valid photo as requested.');
                return;
            }

            ctx.session.answers[question.key] = ctx.message.photo[0].file_id;  // Save the photo file ID

            if (ctx.session.messageId) {
                try {
                    await ctx.deleteMessage(ctx.session.messageId);
                } catch (err) {
                    console.error('Failed to delete message:', err);
                }
            }
            ctx.session.step += 1;
            await askNextQuestion(ctx);
        }
    }
});


async function forwardAnswersToAdmin(ctx) {
    const adminId = process.env.ADMIN_ID; // Admin's Telegram ID
    
    if (!ctx.session || !ctx.session.answers) {
        await ctx.reply('No answers found in session.');
        return;
    }

    const allSections = [...companySections, ...businessSections];
    
    // Loop through each section
    for (const section of allSections) {
        let sectionMessage = `📩 <b>${section.instruction || "Section"}</b>\n\n`;
        
        let hasTextAnswers = false; // To check if this section has any text answers

        // Loop through questions of the current section and gather text answers
        for (const question of section.questions) {
            const answer = ctx.session.answers[question.key];
            
            if (question.type === 'text' && answer) {
                sectionMessage += `📝 <b>${question.text}</b>\n${answer || "N/A"}\n\n`;
                hasTextAnswers = true;
            }
        }

        // If there are any text answers in this section, send the message to admin
        if (hasTextAnswers) {
            await ctx.telegram.sendMessage(adminId, sectionMessage, { parse_mode: 'HTML' });
        }

        // Send photo answers for this section one by one
        for (const question of section.questions) {
            const answer = ctx.session.answers[question.key];
            
            if (question.type === 'photo' && answer) {
                await ctx.telegram.sendPhoto(adminId, answer, {
                    caption: `📷 <b>${question.text}</b>`,
                    parse_mode: 'HTML'
                });
            }
        }
    }

    // After sending all answers, ask admin if they want to start a conversation
    await ctx.telegram.sendMessage(adminId, 'Would you like to start a conversation with the user?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Start Conversation', callback_data: `startchat_${ctx.from.id}` }]
            ]
        }
    });
}


async function initializeTransaction(ctx, amount, role, email) {
    try {
        const requestBody = {
            email: 'email@gmail.com',
            amount: amount * 100,
            metadata: { userId: ctx.from.id, role: role },
            redirect_url: 'http://localhost:6000/paystack/success'
        };

        const response = await axios.post('https://api.paystack.co/transaction/initialize', requestBody, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.data;
    } catch (error) {
        console.error('Error initializing transaction:', error);
        await ctx.reply('An error occurred while generating the payment link. Please try again.');
        return null;
    }
}

async function handleVerifyPayment(ctx, reference) {
    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });

        const { data } = response.data;
        if (data.status === 'success') {
            const role = ctx.session.role;
            const amount = role === 'company' ? 60000 : 25000;

            // Reply to the user
            await ctx.reply('✅ Payment successful! Thank you.');

            // Save the transaction details
            const transactionData = {
                userId: ctx.from.id,
                username: ctx.from.username || 'N/A',
                role: role,
                amount: amount,
                reference: reference,
                date: new Date().toISOString()
            };

            saveTransaction(transactionData);

        } else {
            await ctx.reply('❌ Payment failed or not verified. Please try again.');
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        await ctx.reply('An error occurred while verifying your payment. Please try again.');
    }
}

async function forwardAnswersAndInitiatePayment(ctx) {
    try {
        await forwardAnswersToAdmin(ctx);
        const email = ctx.session.answers.email; 
        await initializeTransaction(ctx, email);
    } catch (error) {
        console.error('Error in forwardAnswersAndInitiatePayment:', error);
    }
}

connectToDatabase().then(() => {
    bot.launch();
    console.log('Bot is running');
});

const app = express();
app.get('/', (req, res) => {
    res.send('Bot is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
