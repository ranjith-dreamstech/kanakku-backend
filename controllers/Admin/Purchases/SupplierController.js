const mongoose = require('mongoose');
const Supplier = require('@models/Supplier');
const User = require('@models/User');
const createSupplier = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { supplier_name, supplier_email, supplier_phone, balance, balance_type } = req.body;
        //create User
        const user = new User({
           firstName,
           lastName,
           email,
           phone, 
        });
        await user.save();

        //create Supplier
        const supplier = new Supplier({
            supplier_name,
            supplier_email,
            supplier_phone,
            balance,
            balance_type,
        });
        await supplier.save();

        //commit transaction
        await session.commitTransaction();
        session.endSession();
        res.status(201).json({ message: 'Supplier created', data: supplier });
    } catch (err) {
        //rollback transaction
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ error: err.message });
    }
}

module.exports = { createSupplier };