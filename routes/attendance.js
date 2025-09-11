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
    console.error('Error checking attendance status:', error);
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
    console.error('Error processing attendance:', error);
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
    console.error('Error during checkout:', error);
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
    console.error('Error during auto-checkout:', error);
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
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({ success: false, message: 'Error fetching attendance records' });
  }
});

// ✅ Get all records for a student (IMPROVED - better data formatting)
router.get('/student/:studentID', async (req, res) => {
  try {
    const { studentID } = req.params;
    console.log('Fetching attendance for student ID:', studentID);
    
    const records = await Attendance.find({ studentID }).sort({ checkInTime: -1 });
    console.log('Found records:', records.length);

    // Transform each record for mobile app consumption
    const transformedRecords = records.map(record => {
      // Ensure dates are properly formatted
      const checkInDate = new Date(record.checkInTime);
      const checkOutDate = record.checkOutTime ? new Date(record.checkOutTime) : null;
      
      return {
        id: record._id.toString(),
        studentID: record.studentID,
        firstName: record.firstName,
        lastName: record.lastName,
        course: record.course,
        yearLevel: record.yearLevel,
        email: record.email,
        purpose: record.purpose || 'General',
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        checkIn: checkInDate.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        }),
        checkOut: checkOutDate ? checkOutDate.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        }) : null,
        date: checkInDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'numeric', 
          day: 'numeric'
        }),
        rawDate: record.checkInTime.toISOString(),
        scanDate: record.scanDate,
        status: record.status,
        duration: record.duration,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });

    res.json({ 
      success: true, 
      records: transformedRecords,
      totalRecords: transformedRecords.length,
      message: `Found ${transformedRecords.length} attendance records`
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching attendance records',
      error: error.message 
    });
  }
});

// ✅ Get attendance statistics for a student
router.get('/student/:studentID/stats', async (req, res) => {
  try {
    const { studentID } = req.params;
    const records = await Attendance.find({ studentID });
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const stats = {
      total: records.length,
      thisMonth: records.filter(record => {
        const recordDate = new Date(record.checkInTime);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      }).length,
      thisWeek: records.filter(record => {
        const recordDate = new Date(record.checkInTime);
        return recordDate >= weekAgo;
      }).length,
      checkedIn: records.filter(r => r.status === 'checked-in').length,
      checkedOut: records.filter(r => r.status === 'checked-out').length,
      autoCheckout: records.filter(r => r.status === 'auto-checkout').length
    };
    
    // Get latest record for current status
    const latestRecord = records.sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))[0];
    
    res.json({
      success: true,
      stats,
      latestRecord: latestRecord ? {
        date: new Date(latestRecord.checkInTime).toLocaleDateString(),
        checkIn: new Date(latestRecord.checkInTime).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        }),
        status: latestRecord.status
      } : null
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching attendance statistics' });
  }
});

// ✅ Delete a specific attendance record (for admin use)
router.delete('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const deletedRecord = await Attendance.findByIdAndDelete(recordId);
    
    if (!deletedRecord) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Update a specific attendance record
router.put('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const updates = req.body;
    
    const updatedRecord = await Attendance.findByIdAndUpdate(recordId, updates, { new: true });
    
    if (!updatedRecord) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    res.json({ success: true, attendance: updatedRecord });
  } catch (error) {
    console.error('Error updating record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;