require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { QuickDB } = require('quick.db');
const { MongoDriver } = require('quickmongo');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const port = process.env.PORT || 3000;
const adminIds = [process.env.ADMIN_ID_1, process.env.ADMIN_ID_2, process.env.ADMIN_ID_3];

const driver = new MongoDriver(process.env.MONGO_URI);

const connectToDatabase = async () => {
    try {
        await driver.connect();
        console.log('Connected to MongoDB');
        bot.DB = new QuickDB({ driver });
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

const companyQuestions = [

    { text: 'Kindly provide us with the following details; Make sure all details are filled', key: 'details_prompt', type: 'text' },
    {
        text: '(1/8) COMPANY DETAILS (provide multiple company names in case anyone has been taken by someone else)\n\nCompany Name 1: _______\nCompany Name 2:_______________\nCompany Name 3:_______________\nCompany Email:__________________\n\nEnsure the name has not been registered by someone else. (Hint: You can provide 3-word names)',
        key: 'company_details',
        type: 'text'
    },
    {
        confirmationText: 'Company Name 1: {{company_name_1}}\nCompany Name 2: {{company_name_2}}\nCompany Name 3: {{company_name_3}}\nCompany Email: {{company_email}}\n\nIs that correct?',
        key: 'company_details_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
            { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
        ]
    },
    {
        text: '(2/8) YOUR BUSINESS ADDRESS\n\n● State:_______________\n● LGA:_______________\n● City/Town/Village:_______________\n● House Number:_______________\n● Street Name: ___________\n\nWhat is the Nature of Business? (as many as possible)',
        key: 'business_address',
        type: 'text'
    },
    {
        confirmationText: 'State: {{business_state}}\nLGA: {{business_lga}}\nCity/Town/Village: {{business_city}}\nHouse Number: {{business_house_number}}\nStreet Name: {{business_street}}\nNature of business: {{nature_of_business}}\n\nIs that correct?',
        key: 'business_address_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
            { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
        ]
    },
    {
        text: '(3/8) DIRECTOR INFORMATION\n\nQUEST: Who is a director?\n\nANS: Directors are people who carry out the day-to-day running of company activities.\n\nKindly fill the form twice if there are more than one director(s).',
        key: 'director_info',
        type: 'text'
    },
    {
        text: 'A. PERSONAL DETAILS\n\n● Surname:____________\n● First Name:____________\n● Other Name:____________\n● Date of Birth:____________\n● Gender:____________\n● Nationality:____________\n● Phone Number:____________\n● Email address: ________',
        key: 'director_personal_details',
        type: 'text'
    },
    {
        text: 'B DIRECTOR RESIDENTIAL ADDRESS\n\n● State:____________\n● LGA:____________\n● City/Town/Village:____________\n● House Number:____________\n● Street Name: __________',
        key: 'director_residential_address',
        type: 'text'
    },
    {
        confirmationText: 'Surname: {{director_surname}}\nFirst Name: {{director_first_name}}\nOther Name: {{director_other_name}}\nDate of Birth: {{director_dob}}\nGender: {{director_gender}}\nNationality: {{director_nationality}}\nPhone Number: {{director_phone}}\nEmail address: {{director_email}}\n\nState: {{director_state}}\nLGA: {{director_lga}}\nCity/Town/Village: {{director_city}}\nHouse Number: {{director_house_number}}\nStreet Name: {{director_street}}\n\nIs that correct?',
        key: 'director_info_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
            { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
        ]
    },
    {
        text: '(4/8) DIRECTOR’S IDENTIFICATION (A): Upload a clear valid means of ID (NIN Slip, Voter’s Card, Driver’s License, International Passport, etc.)',
        key: 'director_id_upload',
        type: 'photo'
    },
    {
        text: '(4/8) DIRECTOR’S IDENTIFICATION (B): Upload your signature (Hint: you can sign on a paper and take a photo)',
        key: 'director_signature_upload',
        type: 'photo'
    },
    {
        text: '(5/10) SHAREHOLDER INFORMATION\n\nA. PERSONAL DETAILS\n\n● Surname:_____________\n● First Name:_____________\n● Other Name:_____________\n● Date of Birth:_____________\n● Gender:_____________\n● Nationality:_____________\n● Phone Number:_____________\n● Email address: _________',
        key: 'shareholder_personal_details',
        type: 'text'
    },
    {
        text: 'B. SHAREHOLDER RESIDENTIAL ADDRESS\n\n● State:_____________\n● LGA:_____________\n● City/Town/Village:_____________\n● House Number:_____________\n● Street Name: ___________',
        key: 'shareholder_residential_address',
        type: 'text'
    },
    {
        confirmationText: 'Surname: {{shareholder_surname}}\nFirst Name: {{shareholder_first_name}}\nOther Name: {{shareholder_other_name}}\nDate of Birth: {{shareholder_dob}}\nGender: {{shareholder_gender}}\nNationality: {{shareholder_nationality}}\nPhone Number: {{shareholder_phone}}\nEmail address: {{shareholder_email}}\n\nState: {{shareholder_state}}\nLGA: {{shareholder_lga}}\nCity/Town/Village: {{shareholder_city}}\nHouse Number: {{shareholder_house_number}}\nStreet Name: {{shareholder_street}}\n\nIs that correct?',
        key: 'shareholder_info_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
            { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
        ]
    },
    {
        text: '(6/8) SHAREHOLDER’S IDENTIFICATION (A): Upload a clear valid means of ID (NIN Slip, Voter’s Card, Driver’s License, International Passport, etc.)',
        key: 'shareholder_id_upload',
        type: 'photo'
    },
    {
        text: '(6/8) SHAREHOLDER’S IDENTIFICATION (B): Upload the Shareholder’s signature',
        key: 'shareholder_signature_upload',
        type: 'photo'
    },
    {
        text: '(7/8) WITNESS INFORMATION\n\n● Surname: ______\n● First Name: INFORMATION\n● Other Name: INFORMATION\n● Phone number: INFORMATION\n● Email: WITNESS INFORMATION\n● Occupation: INFORMATION',
        key: 'witness_info',
        type: 'text'
    },
    {
        text: 'WITNESS RESIDENTIAL ADDRESS\n\n● State:__________\n● LGA:__________\n● City/Town/Village:__________\n● House Number:__________\n● Street Name: ______',
        key: 'witness_residential_address',
        type: 'text'
    },
    {
        confirmationText: 'Surname: {{witness_surname}}\nFirst Name: {{witness_first_name}}\nOther Name: {{witness_other_name}}\nPhone number: {{witness_phone}}\nEmail: {{witness_email}}\nOccupation: {{witness_occupation}}\n\nState: {{witness_state}}\nLGA: {{witness_lga}}\nCity/Town/Village: {{witness_city}}\nHouse Number: {{witness_house_number}}\nStreet Name: {{witness_street}}\n\nIs that correct?',
        key: 'witness_info_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
            { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
        ]
    },
    {
        text: '(8/8) WITNESS IDENTIFICATION (A): Upload a clear valid means of the Witness ID (NIN Slip, Voter’s Card, Driver’s License, International Passport, etc.)',
        key: 'witness_id_upload',
        type: 'photo'
    },
    {
        text: '(8/8) WITNESS IDENTIFICATION (B): Upload a witness signature',
        key: 'witness_signature_upload',
        type: 'photo'
    },
    {
        text: 'The registration process takes 5 - 15 days max.',
        key: 'registration_timeline',
        type: 'text'
    },
    {
        text: 'Complete your Company’s name registration.\n\nPayment verification takes seconds.\n\nProceed with your payment⬇️\n\nCTA - PAY N55,000 (via bank transfer)',
        key: 'payment_cta',
        type: 'text'
    }
];

const businessQuestions = [
    // Add similar structured questions tailored for "Business Name" registration
    {
        text: '(1/8) BUSINESS NAME DETAILS - Business Name 1',
        key: 'business_name_1',
        type: 'text'
    },
    {
        text: '(1/8) BUSINESS NAME DETAILS - Business Email',
        key: 'business_email',
        type: 'text'
    },
    {
        confirmationText: 'Business Name 1: {{business_name_1}}\nBusiness Email: {{business_email}}\n\nIs that correct?',
        key: 'business_details_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT ✅', callback_data: 'yes' },
            { text: 'NO, I MADE A MISTAKE ❗️', callback_data: 'no' }
        ]
    }
    // Add more questions for the business registration path
];

async function deletePreviousMessages(ctx) {
    if (ctx.session.messageId) {
        try {
            await ctx.deleteMessage(ctx.session.messageId);
        } catch (err) {
            console.error('Failed to delete message:', err.message);
        }
        ctx.session.messageId = null; // Reset after deletion
    }
}

async function sendSimultaneousMessages(ctx, messages) {
    const messagePromises = messages.map(async (message) => {
        if (message.type === 'text') {
            return ctx.reply(message.text);
        } else if (message.type === 'photo') {
            return ctx.replyWithPhoto({ source: message.photoPath });
        }
    });

    const sentMessages = await Promise.all(messagePromises);
    ctx.session.messageId = sentMessages[sentMessages.length - 1].message_id; // Track last message ID for deletion
}

bot.command('start', async (ctx) => {
    const adminId = process.env.ADMIN_ID;
    if (ctx.from.id.toString() === adminId) return;

    ctx.session.step = 0;
    ctx.session.answers = {};
    ctx.session.messageId = null;

    // Simultaneous messages
    await sendSimultaneousMessages(ctx, [
        { type: 'text', text: `Thanks for reaching out to Legacy Benjamin Consult.` },
        { type: 'text', text: `How CAC Registration works\n\nIf your WhatsApp TV name ends with "TV", you can ONLY register as a COMPANY.\n\nHowever, if it ends with "Media" or "Entertainment", kindly tick BUSINESS NAME.` },
    ]);

    // Message with HTML content
    await ctx.replyWithHTML(`<b><a href="https://telegra.ph/CAC-FACTS-08-24">LEARN MORE ABOUT CAC REGISTRATION HERE</a></b>`);

    // Message with CTA buttons for "COMPANY" and "BUSINESS NAME"
    await ctx.reply(`Kindly select the category of registration⤵️\n\nCompany N55,000\nBusiness Name N25,000`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '■ COMPANY', callback_data: 'company' }],
                [{ text: '■ BUSINESS NAME', callback_data: 'business' }]
            ]
        }
    });
});

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const questions = ctx.session.role === 'company' ? companyQuestions : businessQuestions;

    if (data === 'company') {
        ctx.session.role = 'company';
        ctx.session.step = 0;
        ctx.session.currentSectionStartKey = 'company_name_1';
        await deletePreviousMessages(ctx); // Delete before sending
        await askNextQuestion(ctx);
    } else if (data === 'business') {
        ctx.session.role = 'business';
        ctx.session.step = 0;
        ctx.session.currentSectionStartKey = 'business_name_1';
        await deletePreviousMessages(ctx); // Delete before sending
        await askNextQuestion(ctx);
    } else if (data === 'yes') {
        ctx.session.step += 1;
        await askNextQuestion(ctx);
    } else if (data === 'no') {
        ctx.session.step = questions.findIndex(q => q.key === ctx.session.currentSectionStartKey);
        await askNextQuestion(ctx);
    }
});

async function askNextQuestion(ctx) {
    const step = ctx.session.step ?? 0;
    const questions = ctx.session.role === 'company' ? companyQuestions : businessQuestions;

    if (step >= questions.length) {
        await ctx.reply('Your request has been submitted to our admins for review.');
        await forwardAnswersToAdmin(ctx);
        return;
    }

    const question = questions[step];

    await deletePreviousMessages(ctx); // Delete before sending new question

    if (question.type === 'confirmation') {
        let confirmationText = question.confirmationText;
        Object.keys(ctx.session.answers).forEach(key => {
            confirmationText = confirmationText.replace(`{{${key}}}`, ctx.session.answers[key]);
        });

        const sentMessage = await ctx.reply(confirmationText, {
            reply_markup: {
                inline_keyboard: question.confirmation_buttons.map(button => [{ text: button.text, callback_data: button.callback_data }])
            }
        });
        ctx.session.messageId = sentMessage.message_id;
    } else {
        const sentMessage = await ctx.reply(question.text);
        ctx.session.messageId = sentMessage.message_id;
    }
}

bot.on('message', async (ctx) => {
    const step = ctx.session.step ?? 0;
    const questions = ctx.session.role === 'company' ? companyQuestions : businessQuestions;
    const question = questions[step];

    if (!question) return;

    ctx.session.answers ??= {};

    if (question.type === 'text') {
        ctx.session.answers[question.key] = ctx.message.text;
        ctx.session.step += 1;
        await askNextQuestion(ctx);
    }
});

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
