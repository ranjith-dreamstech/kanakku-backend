const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const getNextRecurringDate = require('./utils/getNextRecurringDate');

mongoose.connect('mongodb://localhost:27017/kanakku', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log(" Connected to MongoDB");
    runRecurringInvoices();
}).catch(err => {
    console.error("MongoDB connection error:", err);
});

async function runRecurringInvoices() {
    try {
        console.log("Checking for recurring invoices...");

        const invoices = await Invoice.find({ isRecurring: true });

        for (const invoice of invoices) {
            invoice.nextRecurringDate = (getNextRecurringDate('2025-08-13', 'months', 1));
            await invoice.save();
        }

        console.log("Recurring invoices updated.");
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        mongoose.connection.close();
    }
}
