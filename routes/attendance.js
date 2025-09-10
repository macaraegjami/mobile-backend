import { Router } from 'express';
const router = Router();
import Attendance from '../models/Attendance.js';

// ✅ Get all attendance
router.get('/', async (req, res) => {
  try {
    const data = await Attendance.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Check if user is currently checked in
router.get('/status/:studentID', async (req, res) => {
  try {
    const { studentID } = req.params;
    
    // Find the most recent check-in without checkout
    const currentCheckIn = await Attendance.findOne({
      studentID,
      checkOutTime: { $exists: false }
    }).sort({ checkInTime: -1 });

    res.json({
      success: true,
      isCheckedIn: !!currentCheckIn,
      currentSession: currentCheckIn
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error checking attendance status' });
  }
});

// ✅ Scan (ALWAYS create new check-in)
router.post('/scan', async (req, res) => {
  try {
    const { studentID, firstName, lastName, course, yearLevel, purpose, email } = req.body;
    const now = new Date();
    const today = now.toLocaleDateString();

    // ALWAYS create a new check-in record
    const newAttendance = new Attendance({
      studentID, 
      firstName, 
      lastName, 
      course, 
      yearLevel, 
      email, 
      purpose,
      checkInTime: now,
      scanDate: today,
      status: 'checked-in'
    });

    await newAttendance.save();
    
    res.json({ 
      success: true, 
      action: 'checkin', 
      message: 'Successfully checked in', 
      attendance: newAttendance 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error processing attendance' });
  }
});

// ✅ Manual Checkout endpoint
router.post('/checkout/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const now = new Date();
    
    const attendance = await Attendance.findById(recordId);
    
    if (!attendance) {
      return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    }
    
    if (attendance.checkOutTime) {
      return res.status(400).json({ success: false, error: 'Already checked out.' });
    }
    
    attendance.checkOutTime = now;
    attendance.status = 'checked-out';
    attendance.duration = Math.round((now - attendance.checkInTime) / (1000 * 60));
    
    await attendance.save();
    
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Auto-checkout all records at end of day (run as cron job)
router.post('/auto-checkout', async (req, res) => {
  try {
    const now = new Date();
    const today = now.toLocaleDateString();
    
    // Find all records from today that haven't been checked out
    const recordsToUpdate = await Attendance.find({
      scanDate: today,
      checkOutTime: { $exists: false }
    });
    
    let updatedCount = 0;
    
    for (const record of recordsToUpdate) {
      record.checkOutTime = now;
      record.status = 'auto-checkout';
      record.duration = Math.round((now - record.checkInTime) / (1000 * 60));
      await record.save();
      updatedCount++;
    }
    
    res.json({
      success: true,
      message: `Auto-checked out ${updatedCount} records`,
      updatedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Get today's attendance
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString();
    const attendanceRecords = await Attendance.find({ scanDate: today }).sort({ checkInTime: -1 });

    res.json({
      success: true,
      records: attendanceRecords,
      totalCheckedIn: attendanceRecords.filter(r => r.status === 'checked-in').length,
      totalCheckedOut: attendanceRecords.filter(r => r.status === 'checked-out').length,
      totalAutoCheckout: attendanceRecords.filter(r => r.status === 'auto-checkout').length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching attendance records' });
  }
});

// ✅ Get all records for a student (FIXED - show all records, not grouped by date)
router.get('/student/:studentID', async (req, res) => {
  try {
    const { studentID } = req.params;
    const records = await Attendance.find({ studentID }).sort({ checkInTime: -1 });

    // Transform each record individually (no grouping)
    const result = records.map(rec => ({
      id: rec._id,
      date: rec.scanDate,
      checkIn: rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      }) : null,
      checkOut: rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      }) : null,
      purpose: rec.purpose || '',
      rawDate: rec.checkInTime ? rec.checkInTime.toISOString() : null,
      status: rec.status,
      duration: rec.duration,
    }));

    res.json({ success: true, records: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching attendance records' });
  }
});

export default router;