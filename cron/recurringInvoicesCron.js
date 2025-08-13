const cron = require('node-cron');
const Invoice = require('@models/Invoice');

cron.schedule('0 0 * * *', async () => {
  console.log('Checking for recurring invoices...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find invoices due to recur today
  const invoices = await Invoice.find({
    isRecurring: true,
    nextRecurringDate: { $lte: today },
    isDeleted: false
  });

  for (const invoice of invoices) {
    try {
      // Duplicate invoice
      const newInvoice = new Invoice({
        ...invoice.toObject(),
        _id: undefined, // remove old ID so MongoDB creates a new one
        status: 'UNPAID',
        invoiceDate: today,
        dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // example: +7 days
        parentInvoice: invoice._id
      });

      // Update next recurring date
      const nextDate = getNextRecurringDate(today, invoice.recurring, invoice.recurringDuration);
      newInvoice.nextRecurringDate = nextDate;

      await newInvoice.save();

      // Update parent invoice’s nextRecurringDate as well
      invoice.nextRecurringDate = nextDate;
      await invoice.save();

      console.log(`Recurring invoice created: ${newInvoice.invoiceNumber}`);
    } catch (err) {
      console.error('Error creating recurring invoice:', err);
    }
  }
});

function getNextRecurringDate(currentDate, recurring, duration) {
  const date = new Date(currentDate);
  switch (recurring) {
    case 'daily':
      date.setDate(date.getDate() + duration);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * duration));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + duration);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + duration);
      break;
  }
  return date;
}
