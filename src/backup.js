require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { MongoDriver } = require('quickmongo');
const { createReadStream } = require('fs');
const { QuickDB } = require('quick.db');
const express = require('express');
const fs = require('fs-extra');
const axios = require('axios');
const chalk = require('chalk');
const path = require('path');

const port = process.env.PORT || 3000;
const adminIds = [process.env.ADMIN_ID_1, process.env.ADMIN_ID_2, process.env.ADMIN_ID_3];

const designerDataPath = path.join(__dirname, 'designer_data.json');
const influencerDataPath = path.join(__dirname, 'influencer_data.json');
const successfulPaymentsPath = path.join(__dirname, './successful_payments.json');
fs.ensureFileSync(designerDataPath);
fs.ensureFileSync(influencerDataPath);

const driver = new MongoDriver(process.env.MONGO_URI);

const connectToDatabase = async () => {
    try {
        await driver.connect();
        console.log('Connected to MongoDB');
        bot.DB = new QuickDB({ driver });
        bot.User = bot.DB.table('Divina');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const bot = new Telegraf(process.env.BOT_TOKEN);

async function updateUserActivity(userId) {
    const userData = await bot.User.get(`${userId}`);
    if (userData) {
        await bot.User.set(`${userId}`, {
            ...userData,
            lastActive: new Date().toISOString()  // Store the current time as the last active time
        });
    }
}

bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id) {
        await updateUserActivity(ctx.from.id);
    }
    await next();
});

bot.use(session({
    getSessionKey: (ctx) => ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`
}));

bot.use(async (ctx, next) => {
    ctx.session ??= {};
    await next();
});

const influencerQuestions = [
    {
        text: 'Instructions: Endeavor every information you provide is absolutely correct. False information can get your brand de-listed from the website without prior notice.\n\nDo you agree to provide nothing but the true answers to any question we ask you?',
        key: 'agreement',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES I AGREE', callback_data: 'yes' }
        ]
    },
    {
        text: 'Kindly provide us your full name!\n\nNote : must be your real names',
        key: 'full_name',
        type: 'text'
    },
    {
        text: (name) => `So your full name is ${name}. Is that correct?`,
        key: 'name_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT', callback_data: 'yes' },
            { text: 'NO PLEASE I MADE A MISTAKE', callback_data: 'no' }
        ]
    },
    {
        text: 'What is the name of your WhatsApp Community?',
        key: 'community_name',
        type: 'text'
    },
    {
        text: 'Does your WhatsApp Community brand have a CAC Certificate? (Proof will be requested)',
        key: 'cac_certificate',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES', callback_data: 'yes' },
            { text: 'NO', callback_data: 'no' }
        ],
    },
    {
        text: 'Kindly upload a (photo) of your WhatsApp Community CAC Certificate.\n\nEnsure the BN/RC number is clear and visible.',
        key: 'cac_proof',
        type: 'photo'
    },
    {
        text: 'Send your WhatsApp Community brand logo (You can also add multiple flyers to it)',
        key: 'brand_logo',
        type: 'photo',
        multiple: true
    },
    {
        text: 'What is the exact contact size of your WhatsApp Community? (Proof will be requested)',
        key: 'community_size',
        type: 'text'
    },
    {
        text: 'Kindly provide a (video) proof of your current WhatsApp contacts.\n\n⚠️NOTE : While recording the video, make use of another device camera for this recording. The recording should start from your profile picture before you move to your contact list. Screen records are not allowed. 🚫',
        key: 'video_proof',
        type: 'video'
    },
    {
        text: 'Where does the company accept payment?',
        key: 'corporate_account',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'Corporate Bank account', callback_data: 'yes' },
            { text: 'Personal Bank account', callback_data: 'yes' }
        ]
    },
    {
        text: 'What country is your WhatsApp Community operating from?',
        key: 'country_of_operation',
        type: 'text'
    },
    {
        text: 'Provide your best email address. (That is where we will send your receipt)',
        key: 'email_address',
        type: 'text'
    },
    {
        text: 'Thank you for providing us these information. Your responses have been forwarded to our human support team for review.\n\nVerification takes less than 24 hours. While you await in the queue..\n\nYou can use the button below to learn some sales closing hack that can benefit you in wrecking in more sales if peradventure you get listed on our platform.',
        key: 'final_message',
        type: 'text',
        final_message_buttons: [
            { text: 'LEARN HOW TO CLOSE BIG DEALS', url: 'dailyinfluencing.com/how-to-get-better-in-sales-and-close-big-deals' }
        ]
    }
];

const designerQuestions = [
    {
        text: 'Okay. Before we proceed..\n\nKindly provide us your full name?',
        key: 'full_name',
        type: 'text'
    },
    {
        text: (name) => `So your full names are ${name}\n\nIs that correct?`,
        key: 'name_confirmation',
        type: 'confirmation',
        confirmation_buttons: [
            { text: 'YES, IT IS CORRECT', callback_data: 'yes' },
            { text: 'NO PLEASE I MADE A MISTAKE', callback_data: 'no' }
        ]
    },
    {
        text: 'What is the name of your Graphic Design Brand/Agency?',
        key: 'brand_name',
        type: 'text'
    },
    {
        text: 'What software/platform does your brand/agency use for designs?',
        key: 'design_software',
        type: 'text'
    },
    {
        text: 'What kind of designs do you make?\n\n- logo design\n- social media design\n- animation\n- product design\n- branding\n- illustration\n- typography\n- image editing\n- marketing design',
        key: 'design_types',
        type: 'text'
    },
    {
        text: 'Send us a link to your brand/agency\'s portfolio (It could be either of the following: Behance, Instagram, Twitter, Facebook, or any other social platform.)',
        key: 'portfolio_link',
        type: 'text'
    },
    {
        text: 'What country is your brand/agency operating from?',
        key: 'country_of_operation',
        type: 'text'
    },
    {
        text: 'Provide your best email address. (That is where we will send your receipt)',
        key: 'email_address',
        type: 'text'
    },
    {
        text: 'Thank you for providing your information. Our team will review your application and get back to you soon.',
        key: 'final_message',
        type: 'text'
    }
];

bot.log = (text, color = 'green') =>
color ? console.log(chalk.keyword(color)(text)) : console.log(chalk.green(text));

bot.use(async (ctx, next) => {
    const isCmd = ctx.updateType === 'message' && ctx.message.text && ctx.message.text.startsWith('/');
    const from = ctx.from;
    let messageText = '';
    let cmdName = '';
    let args = [];

    if (ctx.updateType === 'message') {
        messageText = ctx.message.text || '';
        cmdName = isCmd ? messageText.split(' ')[0].substring(1) : ''; // Extract command name
        args = isCmd ? messageText.split(' ').slice(1) : []; // Extract arguments
    } else if (ctx.updateType === 'callback_query') {
        messageText = ctx.callbackQuery.message.text || '';
    }

    bot.log(
        `${chalk[isCmd ? 'red' : 'green'](`${isCmd ? '~EXEC' : '~RECV'}`)} ${
            isCmd ? `${bot.options.prefix || '/'}${cmdName}` : 'Callback Query'
        } ${chalk.white('from')} ${from.first_name || ''} ${from.last_name || ''} ${chalk.white(
            `args: [${chalk.blue(args.length)}]`
        )} ${chalk.white(`Message: ${messageText}`)}`,
        'yellow'
    );

    // Pass control to the next middleware or command handler
    await next();
});

bot.use(async (ctx, next) => {
    const adminId = process.env.ADMIN_ID;
    if (ctx.from.id.toString() === adminId) {
        await next();
        return;
    }
    const userData = await bot.User.get(`${ctx.from.id}`);
    if (userData && userData.status === 'Rejected') {
        const now = new Date();
        const rejectionTime = new Date(userData.rejectedAt);
        const hoursPassed = (now - rejectionTime) / (1000 * 60 * 60);

        if (hoursPassed < 24) {
            await ctx.reply('You have been rejected. Please try again after 24 hours.');
            return;
        } else {
            await bot.User.set(`${ctx.from.id}`, { ...userData, status: 'Pending', rejectedAt: null });
        }
    }
    await next();
});

bot.command('start', async (ctx) => {
    const adminId = process.env.ADMIN_ID;
    if (ctx.from.id.toString() === adminId) {
        return;
    }

    const firstName = ctx.from.first_name || '';
    const userData = await bot.User.get(`${ctx.from.id}`);
    console.log('UserData:', userData);
    if (userData && userData.status === 'Approved') {
     return initiatePayment(ctx, userData.role);
    }

    ctx.session.step = 0;
    ctx.session.answers = {};
    ctx.session.messageId = null;

    await ctx.reply(`Hello ${firstName}, I'm glad you showed interest.\n\nI am Dailyinfluencing Subscription Bot. I will guide and walk you through the process of how to get your service listed on Dailyinfluencing.com\n\nAlways use the /start command to restart your progress`)
    await ctx.reply('How do you wish to get listed on our platform?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🪀 As a WhatsApp Influencer', callback_data: 'influencer' }],
                [{ text: '🎨 As a Graphic Designer', callback_data: 'designer' }]
            ]
        }
    });
});

async function getApprovedUsers() {
    try {
        const users = await bot.User.all();
        const approvedUsers = users.filter(user => user.value.status === 'Approved');
        return approvedUsers;
    } catch (error) {
        console.error('Error fetching approved users:', error.message);
        return [];
    }
}

async function sendBroadcastMessage(ctx, messageText) {
    try {
        const approvedUsers = await getApprovedUsers();

        for (const user of approvedUsers) {
            const userId = user.id;

            await ctx.telegram.sendMessage(userId, messageText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'View Subscription', callback_data: 'view_subscription' }]
                    ]
                }
            });

            console.log(`Sent broadcast message to user ${userId}`);

            // Delay for 20 seconds before sending the next message
            await new Promise(resolve => setTimeout(resolve, 20000));
        }

        console.log('Finished sending broadcast messages.');
    } catch (error) {
        console.error('Error sending broadcast messages:', error.message);
    }
}

bot.command('s_broadcast', async (ctx) => {
    const messageText = '🚀 New updates available! Check out your subscription details below:';
    await sendBroadcastMessage(ctx, messageText);
    await ctx.reply('Broadcast started. Messages will be sent with a 20-second delay.');
});

bot.command('list', async (ctx) => {
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    try {
        const userData = await bot.User.get(`${ctx.from.id}`);
        const successfulPayments = await fs.readJson(successfulPaymentsPath);
        const userList = Object.entries(successfulPayments).map(([id, username]) => `ID: ${id}\nUsername: ${username}\n TV's Name: ${userData.community_name}___________________`).join('\n');
        
        await ctx.reply(`List of successfully paid users:\n\n${userList || 'No users found.'}`);
    } catch (err) {
        console.error('Error listing users:', err);
        await ctx.reply('Error fetching user list. Please try again.');
    }
});

bot.command('broadcast', async (ctx) => {
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    const message = ctx.message.text.replace('/broadcast ', '');
    if (!message) {
        await ctx.reply('Please provide a message to broadcast.');
        return;
    }

    try {
        const successfulPayments = await fs.readJson(successfulPaymentsPath);
        for (const userId of Object.keys(successfulPayments)) {
            try {
                await ctx.telegram.sendMessage(userId, message);
            } catch (err) {
                console.error(`Error sending message to user ${userId}:`, err);
            }
        }
        await ctx.reply('Message broadcasted to all successfully paid users.');
    } catch (err) {
        console.error('Error broadcasting message:', err);
        await ctx.reply('Error broadcasting message. Please try again.');
    }
});

bot.command('clear', async (ctx) => {
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    const userId = ctx.message.text.split(' ')[1];
    if (!userId) {
        await ctx.reply('Please provide the user ID to clear.');
        return;
    }

    try {
        // Delete from database
        const userData = await bot.User.get(userId);
        if (userData) {
            await bot.User.delete(userId);
        }

        // Remove from local files
        const [designerData, influencerData] = await Promise.all([
            fs.readJson(designerDataPath).catch(() => ({})),
            fs.readJson(influencerDataPath).catch(() => ({}))
        ]);

        let dataUpdated = false;

        if (designerData[userId]) {
            delete designerData[userId];
            dataUpdated = true;
        }

        if (influencerData[userId]) {
            delete influencerData[userId];
            dataUpdated = true;
        }

        if (dataUpdated) {
            await Promise.all([
                fs.writeJson(designerDataPath, designerData),
                fs.writeJson(influencerDataPath, influencerData)
            ]);
            await ctx.reply(`User data with ID ${userId} has been successfully deleted from local files and database.`);
        } else {
            await ctx.reply(`User with ID ${userId} not found in local files.`);
        }
    } catch (error) {
        console.error('Error clearing user data:', error);
        await ctx.reply('Error clearing user data. Please try again.');
    }
});

bot.command('retrieve', async (ctx) => {
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    const args = ctx.message.text.split(' ');

    if (args.length !== 2) {
        return ctx.reply('Usage: /retrieve <user_id>');
    }

    const userId = args[1];

    // Fetch user data from your bot's database
    const userData = await bot.User.get(userId);

    if (!userData) {
        return ctx.reply(`No data found for user ID: ${userId}`);
    }

    let message = `Data for User ID: <b>${userId}</b>\n\n`;

    for (const [key, value] of Object.entries(userData)) {
        if (Array.isArray(value)) {
            message += `<b>${key}:</b> ${value.join(', ')}\n\n`;
        } else {
            message += `<b>${key}:</b> ${value}\n\n`;
        }
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('cac', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const userData = await bot.User.get(`${userId}`);
        console.log('UserData:', userData);

        if (userData && userData.status === 'Approved') {
            return;
        } else {
            const url = 'https://example.com'; // Replace with your actual URL
            await ctx.reply(
                'It looks like you need to complete some steps before accessing this feature. Please visit the following link:',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Complete Steps', url: url }]
                        ]
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error handling /cac command:', error);
        await ctx.reply('An error occurred while processing your request. Please try again later.');
    }
});

bot.command('support', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const userData = await bot.User.get(`${userId}`);
        console.log('UserData:', userData);

        if (userData && userData.status === 'Approved') {
            return;
        } else {
            const url = 'https://t.me/dailyinfluencingsupport'; // Replace with your actual URL
            await ctx.reply(
                'Contact Our Customer Support Line',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Complete Steps', url: url }]
                        ]
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error handling /support command:', error);
        await ctx.reply('An error occurred while processing your request. Please try again later.');
    }
});

bot.command('check_plan', async (ctx) => {
    // Check if the user issuing the command is an admin
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    // Extract the user ID from the command
    const args = ctx.message.text.split(' ');
    const targetUserId = args[1];

    if (!targetUserId) {
        await ctx.reply('Please provide a user ID. Example: /check_plan <userid>');
        return;
    }

    try {
        const userData = await bot.User.get(`${targetUserId}`);

        if (!userData) {
            await ctx.reply(`User with ID ${targetUserId} does not exist in the database.`);
            return;
        }

        if (!userData || !userData.plan) {
            await ctx.reply('This user does not have an active plan.');
            return;
        }

        // Inform the admin about the user's current plan
        await ctx.reply(`User ${targetUserId}'s current plan is: ${getPlanDurationText(userData.plan)} (${userData.plan})`);

    } catch (error) {
        console.error('Error checking user plan:', error);
        await ctx.reply('An error occurred while checking the plan. Please try again later.');
    }
});

bot.command('delete_plan', async (ctx) => {
    // Check if the user issuing the command is an admin
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    // Extract the user ID from the command
    const args = ctx.message.text.split(' ');
    const targetUserId = args[1];

    if (!targetUserId) {
        await ctx.reply('Please provide a user ID. Example: /delete_plan <userid>');
        return;
    }

    try {
        const userData = await bot.User.get(`${targetUserId}`);

        if (!userData) {
            await ctx.reply(`User with ID ${targetUserId} does not exist in the database.`);
            return;
        }

        if (!userData.plan) {
            await ctx.reply(`User ${targetUserId} does not have an active plan to delete.`);
            return;
        }

        // Delete the user's plan by removing the plan and subscriptionExpiry fields
        await bot.User.set(`${targetUserId}`, {
            ...userData,
            plan: null,
            subscriptionExpiry: null
        });

        await ctx.reply(`User ${targetUserId}'s plan has been successfully deleted.`);

    } catch (error) {
        console.error('Error deleting user plan:', error);
        await ctx.reply('An error occurred while deleting the plan. Please try again later.');
    }
});

bot.command('renew', async (ctx) => {
    try {
            const userId = ctx.from.id;
            const userData = await bot.User.get(`${userId}`);
    
            if (!userData || userData.status !== 'Approved') {
                await ctx.reply('You need to complete the questionnaire and get approved before accessing payment options.');
                return;
            }
    
            let role;

            if (userData.role === 'designer') {
                role = 'designer';
            } else {
                const communitySize = await getUserCommunitySize(userId);
                role = determineRoleByCommunitySize(communitySize);
    
                if (!role) {
                    await ctx.reply('Your community size does not meet the minimum requirement to subscribe to a plan.');
                    return;
                }
            }
    
            const paymentOptions = getPaymentOptions(role);
            if (!paymentOptions) {
                await ctx.reply('No payment options available for your role.');
                return;
            }
    
            const paymentMsg = await ctx.replyWithPhoto({ source: createReadStream(paymentOptions.image) }, {
                caption: paymentOptions.caption,
                reply_markup: { inline_keyboard: paymentOptions.buttons },
                parse_mode: paymentOptions.parse_mode
            });    

            ctx.session.messageIds = ctx.session.messageIds || [];
            ctx.session.messageIds.push(paymentMsg.message_id);

    } catch (error) {
        console.error('Error in /renew command:', error);
        await ctx.reply('An error occurred while processing your renewal. Please try again.');
    }
});

bot.command('help', async (ctx) => {
    // Check if the user issuing the command is an admin
    if (!adminIds.includes(ctx.from.id.toString())) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    // Detailed description of admin commands
    const helpMessage = `
<b>Admin Commands:</b>

<b>/check_plan &lt;user_id&gt;</b>
- Description: Checks the subscription plan of the specified user.
- Usage: /check_plan 123456789
- Example: This command will return the current plan of the user with ID 123456789.

<b>/delete_plan &lt;user_id&gt;</b>
- Description: Deletes the subscription plan of the specified user.
- Usage: /delete_plan 123456789
- Example: This command will delete the current plan of the user with ID 123456789 from the database.

<b>/list</b>
- Description: Lists all users who have successfully made a payment.
- Usage: /list
- Example: This command will return a list of users who have successfully completed a payment.

<b>/broadcast &lt;message&gt;</b>
- Description: Broadcasts a message to all users who have successfully made a payment.
- Usage: /broadcast Your message here
- Example: This command will send "Your message here" to all users with a successful payment.

<b>/clear &lt;user_id&gt;</b>
- Description: Clears the user's data from the local files and the database.
- Usage: /clear 123456789
- Example: This command will remove all data related to the user with ID 123456789.

<b>/retrieve &lt;user_id&gt;</b>
- Description: Retrieves all data associated with a specific user.
- Usage: /retrieve 123456789
- Example: This command will fetch and display all stored data for the user with ID 123456789.

<b>/cac</b>
- Description: Sends a message to the user to complete steps before accessing certain features.
- Usage: /cac
- Example: This command checks if the user is approved and, if not, sends a message with a link to complete the necessary steps.

<b>/support</b>
- Description: Provides the user with contact information for customer support.
- Usage: /support
- Example: This command checks if the user is approved and, if not, sends a message with contact information for support.
`;

    try {
        await ctx.reply(helpMessage, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error sending help message:', error);
        await ctx.reply('An error occurred while sending the help message. Please try again later.');
    }
});

function getPlanDurationText(plan) {
    const durationTexts = {
        '10seconds': '1 Month',
        '20seconds': '3 Months',
        '22seconds': '12 Months'
    };
    return durationTexts[plan] || 'Unknown duration';
}

function isAdmin(userId) {
    const adminIds = [process.env.ADMIN_ID_1, process.env.ADMIN_ID_2, process.env.ADMIN_ID_3]; // List of admin IDs
    return adminIds.includes(userId.toString());
}

bot.command('change_email', async (ctx) => {
    const adminId = ctx.from.id;

    // Check if the user is an admin
    if (!isAdmin(adminId)) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    // Parse the command arguments to get user ID and new email
    const commandArgs = ctx.message.text.split(' ').slice(1);
    if (commandArgs.length !== 2) {
        await ctx.reply('Usage: /changeemail <user_id> <new_email>');
        return;
    }

    const [userId, newEmail] = commandArgs;

    // Validate the new email
    if (!isValidEmail(newEmail)) {
        await ctx.reply('The email you entered is invalid. Please try again.');
        return;
    }

    try {
        // Fetch user data
        let userData = await bot.User.get(`${userId}`);
        if (!userData) {
            await ctx.reply('User not found.');
            return;
        }

        // Update the email in the user data
        userData.email_address = newEmail;
        await bot.User.set(`${userId}`, userData);

        await ctx.reply(`The email for user ID ${userId} has been updated to ${newEmail}.`);
    } catch (error) {
        console.error('Error changing user email:', error);
        await ctx.reply('An error occurred while changing the email. Please try again later.');
    }
});

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [action, userId] = data.split('_');

    if (ctx.from.id.toString() === process.env.ADMIN_ID) {
        if (action === 'approve') {
            const user = await bot.User.get(userId);
            await bot.User.set(`${userId}`, { ...user, status: 'Approved' });

            if (ctx.session.messageId) {
                try {
                    await ctx.deleteMessage(ctx.session.messageId);
                } catch (err) {
                    console.error('Failed to delete message:', err);
                }
            }

            const approvalMessage = await ctx.telegram.sendMessage(userId, `Congratulations! ${user.full_name} Your request has been approved. 🎉\n\nProceed to view our subscription plan so you can get listed on our platform ⬇️`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'VIEW SUBSCRIPTION PLAN', callback_data: 'view_plans' }]
                    ]
                }
            });
            ctx.session.messageId = approvalMessage.message_id;
            await ctx.reply('User approved.');
        } else if (action === 'reject') {
            await ctx.telegram.sendMessage(userId, 'Sorry, your request has been rejected. 😞');
            await bot.User.set(`${userId}`, { status: 'Rejected', rejectedAt: new Date() });
            await ctx.reply('User rejected.');
        }
        return;
    }

    if (data === 'view_plans') {
        const userData = await bot.User.get(`${ctx.from.id}`);
        if (userData && userData.status === 'Approved') {
            if (ctx.session.messageId) {
                try {
                    await ctx.deleteMessage(approvalMessage.message_id);
                } catch (err) {
                    console.error('Failed to delete message:', err);
                }
            }
            console.log('Role:', userData.role)
            return initiatePayment(ctx, userData.role);
        } else {
            await ctx.reply('You need to be approved to view the payment plans.');
        }
        return;
    }
    if (data.startsWith('subscribe')) {
        await handleCallbackQuery(ctx);
        return;
    }
    if (data.startsWith('verify_')) {
        await handleVerifyPayment(ctx);
        return;
    }
    if (data === 'done') {
        await handleDoneCallback(ctx);
    }
    
    if (!ctx.session.role) {
        ctx.session.role = data;
        ctx.session.questions = ctx.session.role === 'designer' ? designerQuestions : influencerQuestions;
        ctx.session.step = 0;

        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

        await bot.User.set(`${ctx.from.id}`, { role: ctx.session.role });
        return askNextQuestion(ctx);
    }

    const step = ctx.session.step || 0;
    const question = ctx.session.questions[step];

    if (!ctx.session.answers) {
        ctx.session.answers = {};
    }

    if (question && question.key === 'cac_certificate') {
        if (data === 'no') {

            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            
            await ctx.reply('We regret to break this to you. You did not meet up with our requirements!\n\nOur Top business owners only wish to work with Professional WhatsApp Influencers with a CAC Certificate.\n\nYou don\'t have a CAC agency? Don\'t worry, use the button below to connect with a CAC agent to get your Certification done.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Contact a CAC Agent', url: 'http://example.com/contact-cac-agent' }]
                    ]
                }
            });

            ctx.session.step = 0;
            ctx.session.answers = {};
            return ctx.reply('Once you obtain a CAC certificate, please start the process again.');
        }
    }

    if (question.type === 'confirmation' && data === 'no') {
        ctx.session.step -= 1;
    } else {
        ctx.session.answers[question.key] = data === 'yes' ? 'Yes' : 'No';
        ctx.session.step += 1;
    }

    await askNextQuestion(ctx);
});

bot.on('message', async (ctx) => {
    if (ctx.from.id.toString() === process.env.ADMIN_ID) {
        return;
    }

    const step = ctx.session.step ?? 0;
    const question = ctx.session.questions?.[step];

    if (!question) return;

    ctx.session.answers ??= {};

    const isPhotoMessage = question.type === 'photo' && ctx.message.photo;
    const isVideoMessage = question.type === 'video' && ctx.message.video;
    const isTextMessage = question.type === 'text' && ctx.message.text;

    // Delete previous bot messages to keep chat clean
    await deletePreviousMessages(ctx);

    if (isTextMessage) {
        handleTextMessage(ctx, question);
    } else if (isPhotoMessage) {
        await handlePhotoMessage(ctx, question);
    } else if (isVideoMessage) {
        await handleVideoMessage(ctx, question);
    } else {
        await handleIncorrectMediaType(ctx, question);
    }
});

async function askNextQuestion(ctx) {
    const step = ctx.session.step ?? 0;
    const questions = ctx.session.role === 'designer' ? designerQuestions : influencerQuestions;

    if (!questions || step >= questions.length) {
        await ctx.reply('Your request has been submitted to our admins for review.\n\nReview takes 1-6hrs. You will be informed about the outcome if you meet our requirements or not.');
        await forwardAnswersToAdmin(ctx);
        return;
    }

    const question = questions[step];
    await deletePreviousMessages(ctx);

    const messageText = typeof question.text === 'function' ? question.text(ctx.session.answers.full_name) : question.text;

    const options = question.type === 'confirmation' ? {
        reply_markup: {
            inline_keyboard: question.confirmation_buttons.map(button => [{ text: button.text, callback_data: button.callback_data }])
        }
    } : {};

    const sentMessage = await ctx.reply(messageText, options);
    ctx.session.messageId = sentMessage.message_id;
}

async function deletePreviousMessages(ctx) {
    if (ctx.session.messageId) {
        try {
            await ctx.deleteMessage(ctx.session.messageId);
            ctx.session.messageId = null;
        } catch (err) {
            console.error('Failed to delete message:', err.message);
        }
    }
    if (ctx.session.repeatQuestionMessageId) {
        try {
            await ctx.deleteMessage(ctx.session.repeatQuestionMessageId);
            ctx.session.repeatQuestionMessageId = null;
        } catch (err) {
            console.error('Failed to delete repeat question message:', err.message);
        }
    }
}

function handleTextMessage(ctx, question) {
    ctx.session.answers[question.key] = ctx.message.text;
    ctx.session.step += 1;
    askNextQuestion(ctx);
}

async function handlePhotoMessage(ctx, question) {
    const fileId = ctx.message.photo[0].file_id;

    if (question.key === 'cac_certificate' || (question.key !== 'brand_logo' && !question.multiple)) {
        if (ctx.session.answers[question.key]) {
            await ctx.deleteMessage(ctx.message.message_id);
            const sentMessage = await ctx.reply('Only one image is allowed. Please resend the correct image.');
            ctx.session.messageId = sentMessage.message_id;
        } else {
            ctx.session.answers[question.key] = [fileId];
            ctx.session.step += 1;
            await askNextQuestion(ctx);
        }
    } else if (question.key === 'brand_logo' || question.multiple) {
        if (!ctx.session.answers[question.key]) {
            ctx.session.answers[question.key] = [];
        }

        ctx.session.answers[question.key].push(fileId);

        if (!ctx.session.logoPrompted) {
            ctx.session.logoPrompted = true;
            const doneMessage = await ctx.reply('When you are done sending photos, click the "Done" button below.', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Done', callback_data: 'done' }]]
                }
            });
            ctx.session.doneMessageId = doneMessage.message_id;
        }
    } else {
        await ctx.reply('Unexpected error occurred while processing the photo.');
    }
}

async function handleVideoMessage(ctx, question) {
    const fileId = ctx.message.video.file_id;

    if (ctx.session.answers[question.key]) {
        await ctx.deleteMessage(ctx.message.message_id);
        const sentMessage = await ctx.reply('Only one video is allowed. Please resend the correct video.');
        ctx.session.messageId = sentMessage.message_id;
    } else {
        ctx.session.answers[question.key] = [fileId];
        ctx.session.step += 1;
        await askNextQuestion(ctx);
    }
}

async function handleIncorrectMediaType(ctx, question) {
    const messageType = question.type === 'photo' ? 'photo' : 'video';
    const errorMessage = await ctx.reply(`Please send the correct media file (${messageType}) as required.`);
    const repeatQuestionMessage = await ctx.reply(question.text);
    ctx.session.messageId = errorMessage.message_id;
    ctx.session.repeatQuestionMessageId = repeatQuestionMessage.message_id;
}

async function handleDoneCallback(ctx) {
    console.log('Current session:', ctx.session);
    if (ctx.session.doneMessageId) {
        console.log('Attempting to delete message with ID:', ctx.session.doneMessageId);
        try {
            await ctx.deleteMessage(ctx.session.doneMessageId);
            console.log('Message deleted successfully');
            ctx.session.doneMessageId = null;
        } catch (err) {
            console.error('Failed to delete "Done" message:', err);
        }
    } else {
        console.warn('No doneMessageId found in session.');
    }
    ctx.session.step += 1;
    await askNextQuestion(ctx);
}

const escapeMarkdown = (text) => {
    return text.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
};

async function forwardAnswersToAdmin(ctx) {
    const answers = ctx.session.answers;
    const adminId = process.env.ADMIN_ID;

    let message = `User ${escapeMarkdown(ctx.from.first_name)} (ID: ${ctx.from.id}) answered the following:\n\n`;
    for (const [key, value] of Object.entries(answers)) {
        const safeKey = escapeMarkdown(key);
        const safeValue = Array.isArray(value) ? value.map(escapeMarkdown).join(', ') : escapeMarkdown(value);
        message += `*${safeKey}*: ${safeValue}\n`;
    }

    const sendPhotoUsingFileId = async (fileId, caption) => {
        try {
            await ctx.telegram.sendPhoto(adminId, fileId, { caption });
        } catch (err) {
            console.error(`Error sending photo with identifier ${fileId}:`, err.message);
            message += `*${escapeMarkdown(caption)}*: Failed to send photo. Error: ${escapeMarkdown(err.message)}\n`;
        }
    };

    const sendVideoUsingFileId = async (fileId, caption) => {
        try {
            await ctx.telegram.sendVideo(adminId, fileId, { caption });
        } catch (err) {
            console.error(`Error sending video with identifier ${fileId}:`, err.message);
            message += `*${escapeMarkdown(caption)}*: Failed to send video. Error: ${escapeMarkdown(err.message)}\n`;
        }
    };

    // Send CAC proof
    if (Array.isArray(answers.cac_proof) && answers.cac_proof.length > 0) {
        await sendPhotoUsingFileId(answers.cac_proof[0], 'CAC Proof');
    }

    // Send video proof
    if (Array.isArray(answers.video_proof) && answers.video_proof.length > 0) {
        await sendVideoUsingFileId(answers.video_proof[0], 'Video Proof');
    }

    // Send brand logos (handle multiple)
    if (Array.isArray(answers.brand_logo) && answers.brand_logo.length > 0) {
        for (const logoFileId of answers.brand_logo) {
            await sendPhotoUsingFileId(logoFileId, 'Brand Logo');
        }
    } else if (answers.brand_logo && answers.brand_logo !== 'No') {
        await sendPhotoUsingFileId(answers.brand_logo, 'Brand Logo'); // If a single ID is provided
    }

    // Send the final message to the admin
    await ctx.telegram.sendMessage(adminId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Approve', callback_data: `approve_${ctx.from.id}` }],
                [{ text: 'Reject', callback_data: `reject_${ctx.from.id}` }]
            ]
        }
    });

    let fileData = {};
    const filePath = ctx.session.role === 'designer' ? designerDataPath : influencerDataPath;

    try {
        fileData = await fs.readJson(filePath);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`File not found: ${filePath}, initializing with an empty object.`);
        } else if (err.name === 'SyntaxError') {
            console.error(`Syntax error in ${filePath}:`, err.message);
            console.log(`Resetting ${filePath} to an empty object.`);
        } else {
            console.error(`Error reading ${filePath}:`, err);
            throw err;
        }
    }

    fileData[ctx.from.id] = answers;

    try {
        await fs.writeJson(filePath, fileData);
    } catch (err) {
        console.error(`Error writing to ${filePath}:`, err);
        throw err;
    }

    await bot.User.set(`${ctx.from.id}`, { ...answers, role: ctx.session.role, status: 'Pending' });

    await ctx.reply('Your answers have been forwarded to the admin for review. Thank you!');
}

function getPaymentOptions(role) {
    const options = {
        designer: {
            image: path.join(__dirname, './img/graphics.jpg'),
            caption: `<b>You are very close to getting listed on our premium platform!</b>\n\nSelect a Subscription plan♻️\n\n<b>1 MONTH</b>\n<s>₦55,000</s>➔ <b>₦37,500 / month</b>\n\n<b>3 MONTHS ⭐️(42% Off)</b>\n₦29,350 / month \n<s>₦165,000</s> ➔ <b>₦91,500</b>\n\n<b>12 MONTHS ⭐️⭐️(48% Off)</b>\n₦26,100 / month \n<s>₦660,000</s> ➔ <b>₦366,000</b>`,
            buttons: [
                [{ text: 'Subscribe to 1 Month (₦37,500)', callback_data: 'subscribe_designer_1month' }],
                [{ text: 'Subscribe to 3 Months (₦91,500)', callback_data: 'subscribe_designer_3months' }],
                [{ text: 'Subscribe to 12 Months (₦366,000)', callback_data: 'subscribe_designer_12months' }],
            ],
            parse_mode: 'HTML'
        },
        micro_influencer: {
            image: path.join(__dirname, './img/micro.jpg'),
            caption: `<b>You are very close to getting listed on our premium platform!</b>\n\nSelect a Subscription plan♻️\n\n<b>1 MONTH</b>\n<s>₦50,000</s> ➔ <b>₦34,000 / month</b>\n\n<b>3 MONTHS ⭐️(42% Off)</b>\n₦29,350 / month\n<s>₦150,000</s> ➔ <b>₦88,000</b>\n\n<b>12 MONTHS ⭐️⭐️(48% Off)</b>\n₦26,100 / month \n<s>₦600,000</s> ➔ <b>₦313,000</b>`,
            buttons: [
                [{ text: 'Subscribe to 1 Month (₦34,000)', callback_data: 'subscribe_micro_influencer_1month' }],
                [{ text: 'Subscribe to 3 Months (₦88,000)', callback_data: 'subscribe_micro_influencer_3months' }],
                [{ text: 'Subscribe to 12 Months (₦313,000)', callback_data: 'subscribe_micro_influencer_12months' }],
            ],
            parse_mode: 'HTML'
        },
        standard_influencer: {
            image: path.join(__dirname, './img/standard.jpg'),
            caption: `<b>You are very close to getting listed on our premium platform!</b>\n\nSelect a Subscription plan♻️\n\n<b>1 MONTH</b>\n<s>₦78,000</s>➔ <b>₦49,000 / month</b>\n\n<b>3 MONTHS ⭐️(42% Off)</b>\n39,350 / month \n<s>₦234,000</s> ➔ <b>₦188,000</b>\n\n<b>12 MONTHS ⭐️⭐️(48% Off)</b>\n₦33,590 / month \n<s>₦936,000</s> ➔ <b>₦403,000</b>`,
            buttons: [
                [{ text: 'Subscribe to 1 Month (₦49,000)', callback_data: 'subscribe_standard_influencer_1month' }],
                [{ text: 'Subscribe to 3 Months (₦188,000)', callback_data: 'subscribe_standard_influencer_3months' }],
                [{ text: 'Subscribe to 12 Months (₦403,000)', callback_data: 'subscribe_standard_influencer_12months' }],
            ],
            parse_mode: 'HTML'
        },
        mega_influencer: {
            image: path.join(__dirname, './img/mega.jpg'),
            caption: `<b>You are very close to getting listed on our premium platform!</b>\n\nSelect a Subscription plan♻️\n\n<b>1 MONTH</b>\n<s>₦100,000</s> ➔ <b>₦65,000 / month</b>\n\n<b>3 MONTHS ⭐️(42% Off)</b>\n53,350 / month \n<s>₦300,000</s> ➔ <b>₦160,000</b>\n\n<b>12 MONTHS ⭐️⭐️(48% Off)</b>\n₦45,920 / month \n<s>₦1,500,000</s> ➔ <b>₦551,000</b>`,
            buttons: [
                [{ text: 'Subscribe to 1 Month (₦65,000)', callback_data: 'subscribe_mega_influencer_1month' }],
                [{ text: 'Subscribe to 3 Months (₦160,000)', callback_data: 'subscribe_mega_influencer_3months' }],
                [{ text: 'Subscribe to 12 Months (₦551,000)', callback_data: 'subscribe_mega_influencer_12months' }],
            ],
            parse_mode: 'HTML'
        }
    };

    return options[role] || null;
}

function getAmount(role, plan) {
    const amounts = {
        designer: { '1month': 37500, '3months': 91500, '12months': 366000 },
        micro_influencer: { '1month': 34000, '3months': 88000, '12months': 313000 },
        standard_influencer: { '1month': 49000, '3months': 188000, '12months': 403000 },
        mega_influencer: { '1month': 65000, '3months': 160000, '12months': 551000 }
    };
    return amounts[role]?.[plan] || null;
}

function calculateExpiryDate(plan) {
    const now = new Date();
    const planSeconds = getPlanDuration(plan);
    now.setSeconds(now.getSeconds() + (planSeconds || 0));
    return now;
}

function getPlanDuration(plan) {
    const planSeconds = {
        '1month': 2592000,  // 30 days in seconds
        '3months': 7776000,  // 90 days in seconds
        '12months': 31104000 // 360 days in seconds
    };
    return planSeconds[plan] || 0;
}

async function initiatePayment(ctx) {
    try {
        const userId = ctx.from.id;
        const userData = await bot.User.get(`${userId}`);

        if (!userData || userData.status !== 'Approved') {
            await ctx.reply('You need to complete the questionnaire and get approved before accessing payment options.');
            return;
        }

        let role;
        if (userData.role === 'designer') {
            role = 'designer';
        } else {
            const communitySize = await getUserCommunitySize(userId);
            role = determineRoleByCommunitySize(communitySize);

            if (!role) {
                await ctx.reply('Your community size does not meet the minimum requirement to subscribe to a plan.');
                return;
            }
        }

        const paymentOptions = getPaymentOptions(role);
        if (!paymentOptions) {
            await ctx.reply('No payment options available for your role.');
            return;
        }

        const paymentMsg = await ctx.replyWithPhoto({ source: createReadStream(paymentOptions.image) }, {
            caption: paymentOptions.caption,
            reply_markup: { inline_keyboard: paymentOptions.buttons },
            parse_mode: paymentOptions.parse_mode
        });

        ctx.session.messageIds = ctx.session.messageIds || [];
        ctx.session.messageIds.push(paymentMsg.message_id);

    } catch (error) {
        console.error('Error in initiatePayment:', error);
        await ctx.reply('An error occurred while showing payment options. Please try again later.');
    }
}

async function handleCallbackQuery(ctx) {
    const data = ctx.callbackQuery.data;
    const [action, role, plan] = data.split('_');

    console.log('Callback data:', data);
    console.log('Parsed action:', action);
    console.log('Parsed role:', role);
    console.log('Parsed plan:', plan);

    const validRoles = ['designer', 'micro_influencer', 'standard_influencer', 'mega_influencer'];
    if (!validRoles.includes(role)) {
        console.error(`Invalid role detected: ${role}`);
        return;
    }

    // Delete previous messages if any
    if (ctx.session && ctx.session.messageIds) {
        for (const messageId of ctx.session.messageIds) {
            try {
                await ctx.deleteMessage(messageId);
                console.log(`Deleted message with ID: ${messageId}`);
            } catch (err) {
                console.error('Failed to delete the previous message:', err);
            }
        }
        ctx.session.messageIds = [];
    }

    if (action === 'subscribe') {
        const userData = await bot.User.get(`${ctx.from.id}`);
        if (!userData) {
            await ctx.reply('You need to start the conversation with the bot before subscribing to a plan.');
            return;
        }

        const amount = getAmount(role, plan);
        if (!amount) {
            console.error('Invalid plan selected:', plan);
            await ctx.reply('Invalid plan selected. Please try again.');
            return;
        }

        const transaction = await initializeTransaction(ctx, amount, plan);
        if (transaction) {
            const replyMessage = await ctx.reply("Click the button below to complete your payment:", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Pay Now', web_app: { url: transaction.authorization_url } }],
                        [{ text: 'I\'ve made the payment', callback_data: `verify_${transaction.reference}` }]
                    ]
                }
            });
            ctx.session.messageIds.push(replyMessage.message_id);
        }
    } else if (action === 'verify') {
        await handleVerifyPayment(ctx);
    } else {
        console.error('Invalid action:', action);
    }
}

async function initializeTransaction(ctx, amount, plan) {
        try {
            const userData = await bot.User.get(`${ctx.from.id}`);
    
            if (!userData || !userData.email_address) {
                await ctx.reply('No email address found for this user. Please update your profile.');
                return null;
            }
    
            const email = userData.email_address;
            const requestBody = {
                email: email,
                amount: amount * 100,
                metadata: { chatId: ctx.from.id, plan: plan },
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
            await ctx.reply(`Your email address is invalid or not provided. \n\nKindly provide your a valid email address to our support inbox : @dailyinfluencingsupport`);
            return null;
        }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function getUserCommunitySize(userId) {
    const userData = await bot.User.get(`${userId}`);
    return userData?.community_size || 0;
}

function determineRoleByCommunitySize(communitySize) {
    if (communitySize >= 100000) {
        return 'mega_influencer';
    } else if (communitySize >= 50000) {
        return 'standard_influencer';
    } else if (communitySize >= 10000) {
        return 'micro_influencer';
    } else {
        return null;
    }
}

async function checkForInactiveUsers() {
    console.log('Starting to check for inactive users...');

    try {
        const users = await bot.User.all();
        console.log('Retrieved users:', users);

        users.forEach(async (user) => {
            const userId = user.id;
            const userData = user.value;
            const now = new Date();

            console.log(`Checking user: ${userId}, Name: ${userData.full_name}, Status: ${userData.status}`);

            if (userData.status === 'Approved' && !userData.plan) {
                const lastActive = new Date(userData.lastActive);
                const hoursInactive = (now - lastActive) / (1000 * 60 * 60);

                console.log(`User ${userId} has been inactive for ${hoursInactive} seconds`);

                if (hoursInactive >= 1 && hoursInactive < 12) {
                    console.log(`Sending first reminder to user ${userId}`);
                await sendReminder(userId, `${userData.full_name} complete your order before it gets expired. Just a few steps remaining, Let’s do it! 👏`);
            } else if (hoursInactive >= 12 && hoursInactive < 24) {
                console.log(`Sending second reminder to user ${userId}`);
                await sendReminder(userId, `${userData.full_name} Just 2 Slot left! You’re very close to getting your service listed on our platform. Let’s finish this up👊`);
            } else if (hoursInactive >= 24) {
                console.log(`Sending final reminder with support button to user ${userId}`);
                await sendReminder(userId, `${userData.full_name}, contact our human support if you have any questions. We are open to help you⤵️`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Support', url: 'https://t.me/dailyinfluencingsupport' }]
                        ]
                    }
                });
            }
            } else {
                console.log(`User ${userId} is either not approved or already has a plan.`);
            }
        });
    } catch (error) {
        console.error('Error while checking for inactive users:', error.message);
    }

    console.log('Finished checking for inactive users.');
}

async function sendReminder(userId, message, options = {}) {
    try {
        console.log(`Attempting to send a reminder to user ${userId}`);
        await bot.telegram.sendMessage(userId, message, options);
        console.log(`Successfully sent reminder to user ${userId}`);
    } catch (error) {
        console.error(`Failed to send reminder to user ${userId}:`, error.message);
    }
}

setInterval(checkForInactiveUsers, 60 * 1000);

async function handleVerifyPayment(ctx) {
    const data = ctx.callbackQuery.data;
    const [, reference] = data.split('_');

    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });

        const transaction = response.data.data;

        if (transaction.status === 'success') {
            console.log(`Storing plan ${transaction.metadata.plan} for user ${ctx.from.id}`);
            const expiryDate = calculateExpiryDate(transaction.metadata.plan);
            const userData = await bot.User.get(`${ctx.from.id}`);
            await bot.User.set(`${ctx.from.id}`, {
                ...userData,
                status: 'Approved',
                subscriptionExpiry: expiryDate,
                plan: transaction.metadata.plan
            });
            const paymentData = {
                userId: ctx.from.id,
                name: userData.full_name,
                email: userData.email_address,
                reference: transaction.reference,
                amount: transaction.amount / 100,
                date: new Date().toISOString(),
                plan: transaction.metadata.plan
            };
            const paymentFilePath = './payments.json';
            let payments = await readJsonSafely(paymentFilePath);
            payments[transaction.reference] = paymentData;
            await fs.writeJson(paymentFilePath, payments);
            const successfulPaymentsPath = './successfulPayments.json';
            let successfulPayments = await readJsonSafely(successfulPaymentsPath);
            successfulPayments[ctx.from.id] = ctx.from.username || `${userData.full_name}`;
            await fs.writeJson(successfulPaymentsPath, successfulPayments);
            await ctx.reply('Your Payment was successful! 🎉\n\nOur team has started processing your subscription with the above details you provided. Your graphic design brand/agency will be listed on our website within 1-3hrs.\n\nIf you have any questions, kindly reach out to our support @dailyinfluencingsupport');
            const adminMessage = `<pre>
User: ${userData.full_name}
Email: ${userData.email_address}
Reference: ${reference}
Plan: ${transaction.metadata.plan}
Amount Paid: ${transaction.amount / 100} NGN
</pre>`;
            const adminIds = [process.env.ADMIN_ID_1, process.env.ADMIN_ID_2, process.env.ADMIN_ID_3];
            for (const adminId of adminIds) {
                await ctx.telegram.sendMessage(adminId, adminMessage, { parse_mode: 'HTML' });
            }

            await startSubscriptionTimer(ctx, transaction.metadata.plan, ctx.from.id);
        } else {
            await ctx.reply('Payment failed. Please try again.');
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        await ctx.reply('Error verifying payment. Please try again.');
    }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;

async function startSubscriptionTimer(ctx, plan, userId) {
    try {
        const userData = await bot.User.get(userId.toString());
        if (!userData || !userData.subscriptionExpiry) {
            console.error(`No subscription expiry found for user ${userId}.`);
            return;
        }

        const expirationTime = new Date(userData.subscriptionExpiry).getTime();
        const now = Date.now();
        const timeRemaining = expirationTime - now;

        if (timeRemaining <= 0) {
            console.log(`Subscription for user ${userId} has already expired.`);
            await expireSubscription(ctx, userId);
            return;
        }

        console.log(`Subscription for user ${userId} ends in ${(timeRemaining / (1000 * 60 * 60)).toFixed(2)} hours.`);

        const reminderTimes = {
            4: expirationTime - 4 * DAY_IN_MS,
            3: expirationTime - 3 * DAY_IN_MS,
            2: expirationTime - 2 * DAY_IN_MS,
            1: expirationTime - DAY_IN_MS,
            0: expirationTime - HOUR_IN_MS
        };

        await bot.User.set(userId.toString(), { reminderTimes, expirationTime });

        const checkReminders = async () => {
            const now = Date.now();
            for (const [daysBefore, reminderTime] of Object.entries(reminderTimes)) {
                if (reminderTime <= now && reminderTime + HOUR_IN_MS > now) {  
                    console.log(`Sending ${daysBefore} days before reminder for user ${userId}.`);
                    await sendReminder(userId, `Your subscription will end in ${daysBefore} days. Please renew soon!`);
                    delete reminderTimes[daysBefore];
                    await bot.User.set(userId.toString(), { reminderTimes }); 
                }
            }
            if (now >= expirationTime) {
                await expireSubscription(ctx, userId);
                clearInterval(reminderInterval);
            }
        };

        const reminderInterval = setInterval(checkReminders, HOUR_IN_MS);
        await checkReminders(); 

    } catch (error) {
        console.error(`Error in startSubscriptionTimer for user ${userId}:`, error.message);
    }
}

async function expireSubscription(ctx, userId) {
    try {
        console.log(`Expiring subscription for user ${userId}.`);

        const userData = await bot.User.get(userId.toString());
        if (!userData) {
            console.error(`No data found for user ${userId}.`);
            return;
        }

        await ctx.telegram.sendMessage(userId, 'Your subscription has ended and your account has been removed. Please renew to continue using our services.');

        await bot.User.delete(userId.toString());

        console.log(`Subscription for user ${userId} has been expired and user removed from the database.`);
    } catch (error) {
        console.error(`Error expiring subscription for user ${userId}:`, error.message);
    }
}

async function reinitializeTimers(ctx, bot) {
    try {
        if (!bot || !bot.User) {
            throw new Error('Bot or User object is undefined');
        }

        const allUsers = await bot.User.all();

        for (const { id, data } of allUsers) {
            if (data && data.subscriptionExpiry) {
                const expirationTime = new Date(data.subscriptionExpiry).getTime();
                const now = Date.now();

                if (expirationTime > now) {
                    console.log(`Reinitializing subscription timer for user ${id}`);
                    await startSubscriptionTimer(ctx, data.plan, id);
                }
            }
        }
    } catch (error) {
        console.error(`Error reinitializing timers:`, error.message);
    }
}
// Don't call reinitializeTimers here, it should be called with proper arguments
// reinitializeTimers();

function getPlanDurationText(plan) {
    const durationTexts = {
        '1 Month': '1 Month',
        '3 Months': '3 Months',
        '12 Months': '12 Months'
    };
    return durationTexts[plan] || 'Unknown duration';
}

async function readJsonSafely(filePath) {
    try {
        return await fs.readJson(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`File not found: ${filePath}`);
        } else if (error.name === 'SyntaxError') {
            console.error(`Syntax error in file: ${filePath}`, error.message);
        } else {
            console.error(`Error reading JSON from file: ${filePath}`, error);
        }
        return {};
    }
}

connectToDatabase().then(() => {
    bot.launch();
    reinitializeTimers(bot.telegram, bot);
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
