import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';
import {
  History, X, Save, Edit3, Package, PlusCircle, Trash2, CheckCircle2,
  ArrowUpCircle, ArrowDownCircle, Award, Shirt, FileText
} from 'lucide-react';

const SIZE_RANK = { "XS": 1, "S": 2, "M": 3, "L": 4, "XL": 5, "XXL": 6, "3XL": 7, "4XL": 8, "5XL": 9 };
const MEDAL_ORDER = { "ทอง": 1, "เงิน": 2, "ทองแดง": 3 };

function App() {
  const [exams, setExams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [operator, setOperator] = useState('');
  const [adjustAmount, setAdjustAmount] = useState({});
  const [editCoverName, setEditCoverName] = useState({});

  // Tabs and Filters for detail popup
  const [activeTab, setActiveTab] = useState('shirts');
  const [yearFilter, setYearFilter] = useState('ทั้งหมด');

  // Log Filters
  const [logFilterExam, setLogFilterExam] = useState('ทั้งหมด');
  const [logFilterAction, setLogFilterAction] = useState('ทั้งหมด');

  // Form States for adding new exam
  const [examName, setExamName] = useState('');

  // Inline Forms States (Inside popup)
  const [showAddShirtForm, setShowAddShirtForm] = useState(false);
  const [newShirtName, setNewShirtName] = useState('');
  const [newShirtSizes, setNewShirtSizes] = useState({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 });

  const [showAddMedalForm, setShowAddMedalForm] = useState(false);
  const [newMedalName, setNewMedalName] = useState('');
  const [newMedalSubTypes, setNewMedalSubTypes] = useState({ ทอง: 0, เงิน: 0, ทองแดง: 0 });

  const [showAddCoverForm, setShowAddCoverForm] = useState(false);
  const [newCoverNameForm, setNewCoverNameForm] = useState('');
  const [newCoverQty, setNewCoverQty] = useState(0);

  // Temporary Exam Name for Inline Rename in Popup Header
  const [tempExamName, setTempExamName] = useState('');

  // Inline renaming states for Shirt Model Names and Medal Names
  const [editShirtName, setEditShirtName] = useState({});
  const [editingShirtKey, setEditingShirtKey] = useState(null);

  const [editMedalName, setEditMedalName] = useState({});
  const [editingMedalKey, setEditingMedalKey] = useState(null);

  useEffect(() => {
    // Sort by examName alphabetically asc so cards remain in stable order
    const q = query(collection(db, "exams"), orderBy("examName", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(data);
      if (selectedExam) {
        const updated = data.find(item => item.id === selectedExam.id);
        if (updated) setSelectedExam(updated);
      }
    });
    const logQ = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsubscribeLogs = onSnapshot(logQ, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubscribe(); unsubscribeLogs(); };
  }, [selectedExam]);

  const resetInlineForms = () => {
    setShowAddShirtForm(false);
    setNewShirtName('');
    setNewShirtSizes({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 });

    setShowAddMedalForm(false);
    setNewMedalName('');
    setNewMedalSubTypes({ ทอง: 0, เงิน: 0, ทองแดง: 0 });

    setShowAddCoverForm(false);
    setNewCoverNameForm('');
    setNewCoverQty(0);

    setEditingShirtKey(null);
    setEditingMedalKey(null);
  };

  const sortSizes = (sizeObj) => {
    return Object.entries(sizeObj).sort(([a], [b]) => (SIZE_RANK[a.toUpperCase()] || 99) - (SIZE_RANK[b.toUpperCase()] || 99));
  };

  const sortMedals = (medalsObj) => {
    return Object.entries(medalsObj).sort(([a], [b]) => {
      const rankA = MEDAL_ORDER[a] || 99;
      const rankB = MEDAL_ORDER[b] || 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  };

  const extractYearsFromKeys = (keys) => {
    const yearsSet = new Set();
    keys.forEach(key => {
      const match = key.match(/\b(20\d{2})\b/);
      if (match) yearsSet.add(match[1]);
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    return ['ทั้งหมด', ...sortedYears];
  };

  const handleDeleteExam = async (e, exam) => {
    e.stopPropagation();
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อนลบ");
    if (window.confirm(`⚠️ ยืนยันการลบ "${exam.examName}"?`)) {
      await deleteDoc(doc(db, "exams", exam.id));
      await addDoc(collection(db, "logs"), {
        examName: exam.examName, action: "ลบรายการ", details: "ลบรายการออกจากระบบแล้ว!!", operator, timestamp: serverTimestamp()
      });
    }
  };

  const quickAdjust = async (category, subCategory, field, mode) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ทำรายการก่อน");
    const amountKey = `${category}-${subCategory}-${field}`;
    const amountToChange = Number(adjustAmount[amountKey] || 1);
    const examRef = doc(db, "exams", selectedExam.id);

    let updatedVal;
    const currentVal = subCategory ? (selectedExam[category][subCategory]?.[field] || 0) : (selectedExam[category]?.[field] || 0);

    if (mode === 'add') updatedVal = currentVal + amountToChange;
    else updatedVal = Math.max(0, currentVal - amountToChange);

    const updatePayload = { updatedAt: serverTimestamp() };
    if (subCategory) {
      const newSubData = { ...selectedExam[category] };
      if (!newSubData[subCategory]) newSubData[subCategory] = {};
      newSubData[subCategory][field] = updatedVal;
      updatePayload[category] = newSubData;
    } else {
      const newData = { ...selectedExam[category] };
      newData[field] = updatedVal;
      updatePayload[category] = newData;
    }

    await updateDoc(examRef, updatePayload);
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: mode === 'add' ? "เพิ่มสต็อก" : "ลดสต็อก",
      details: `${category} ${subCategory || ''} ${field} จำนวน ${amountToChange}`, operator, timestamp: serverTimestamp()
    });
    setAdjustAmount({ ...adjustAmount, [amountKey]: '' });
  };

  // ==================== EXAM INLINE RENAME ====================
  const handleRenameExam = async () => {
    if (!operator) {
      alert("กรุณาระบุชื่อผู้ใช้งานก่อนแก้ไข");
      setTempExamName(selectedExam.examName);
      return;
    }
    if (!tempExamName || !tempExamName.trim()) {
      alert("ชื่อรายการสอบต้องไม่ว่างเปล่า");
      setTempExamName(selectedExam.examName);
      return;
    }
    const newName = tempExamName.trim();
    if (newName === selectedExam.examName) return;

    try {
      const examRef = doc(db, "exams", selectedExam.id);
      await updateDoc(examRef, { examName: newName, updatedAt: serverTimestamp() });
      await addDoc(collection(db, "logs"), {
        examName: newName, action: "แก้ไขชื่อรายการสอบ",
        details: `เปลี่ยนชื่อรายการสอบจาก "${selectedExam.examName}" เป็น "${newName}"`,
        operator, timestamp: serverTimestamp()
      });
    } catch (e) {
      alert(e.message);
      setTempExamName(selectedExam.examName);
    }
  };

  // ==================== SHIRTS CRUD ====================
  const handleSizeQtyChange = (size, value) => {
    setNewShirtSizes(prev => ({ ...prev, [size]: Number(value) }));
  };

  const addCustomSizeInForm = () => {
    const sizeLabel = prompt("ระบุไซส์พิเศษที่ต้องการเพิ่ม (เช่น 4XL, เด็ก):");
    if (!sizeLabel) return;
    const normalizedSize = sizeLabel.toUpperCase().trim();
    if (newShirtSizes[normalizedSize] !== undefined) return alert("มีไซส์นี้ในแบบเสื้อแล้ว");
    setNewShirtSizes(prev => ({ ...prev, [normalizedSize]: 0 }));
  };

  const handleCreateShirt = async (e) => {
    e.preventDefault();
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!newShirtName.trim()) return alert("กรุณากรอกชื่อรุ่นเสื้อ");

    const shirtKey = newShirtName.trim();
    if (selectedExam.shirts?.[shirtKey]) return alert("มีแบบเสื้อชื่อนี้อยู่แล้ว");

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedShirts = {
      ...selectedExam.shirts,
      [shirtKey]: { ...newShirtSizes }
    };

    await updateDoc(examRef, { shirts: updatedShirts, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เพิ่มแบบเสื้อ",
      details: `เพิ่มแบบเสื้อใหม่: "${shirtKey}"`, operator, timestamp: serverTimestamp()
    });

    // Reset Form
    setNewShirtName('');
    setNewShirtSizes({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 });
    setShowAddShirtForm(false);
  };

  const handleRenameShirt = async (oldName) => {
    const newName = editShirtName[oldName]?.trim();
    if (!newName || oldName === newName) {
      setEditingShirtKey(null);
      return;
    }
    if (!operator) {
      alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
      setEditingShirtKey(null);
      return;
    }
    if (selectedExam.shirts?.[newName]) {
      alert("มีแบบเสื้อชื่อนี้อยู่แล้ว");
      return;
    }

    try {
      const examRef = doc(db, "exams", selectedExam.id);
      const updatedShirts = { ...selectedExam.shirts };
      updatedShirts[newName] = updatedShirts[oldName];
      delete updatedShirts[oldName];

      await updateDoc(examRef, { shirts: updatedShirts, updatedAt: serverTimestamp() });
      await addDoc(collection(db, "logs"), {
        examName: selectedExam.examName, action: "เปลี่ยนชื่อเสื้อ",
        details: `เปลี่ยนชื่อเสื้อจาก "${oldName}" เป็น "${newName}"`, operator, timestamp: serverTimestamp()
      });
      setEditingShirtKey(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteShirtInDetail = async (type) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!window.confirm(`⚠️ ยืนยันการลบแบบเสื้อ "${type}" และสต็อกไซส์ทั้งหมดในรุ่นนี้?`)) return;

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedShirts = { ...selectedExam.shirts };
    delete updatedShirts[type];

    await updateDoc(examRef, { shirts: updatedShirts, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "ลบแบบเสื้อ",
      details: `ลบแบบเสื้อ: "${type}" ออกจากระบบ`, operator, timestamp: serverTimestamp()
    });
  };

  const addSizeToShirtInDetail = async (type) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    const sizeLabel = prompt("ระบุไซส์พิเศษที่ต้องการเพิ่ม (เช่น 4XL, เด็ก):");
    if (!sizeLabel) return;
    const normalizedSize = sizeLabel.toUpperCase().trim();
    if (selectedExam.shirts[type]?.[normalizedSize] !== undefined) return alert("มีไซส์นี้ในรุ่นนี้อยู่แล้ว");

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedShirts = { ...selectedExam.shirts };
    updatedShirts[type] = { ...updatedShirts[type], [normalizedSize]: 0 };

    await updateDoc(examRef, { shirts: updatedShirts, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เพิ่มไซส์เสื้อ",
      details: `เพิ่มไซส์ "${normalizedSize}" ในเสื้อรุ่น "${type}"`, operator, timestamp: serverTimestamp()
    });
  };

  const deleteSizeFromShirtInDetail = async (type, sizeLabel) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!window.confirm(`ลบไซส์ "${sizeLabel}" ของเสื้อรุ่น "${type}"?`)) return;

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedShirts = { ...selectedExam.shirts };
    delete updatedShirts[type][sizeLabel];

    await updateDoc(examRef, { shirts: updatedShirts, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "ลบไซส์เสื้อ",
      details: `ลบไซส์ "${sizeLabel}" ในเสื้อรุ่น "${type}"`, operator, timestamp: serverTimestamp()
    });
  };

  // ==================== MEDALS CRUD ====================
  const handleMedalSubQtyChange = (type, value) => {
    setNewMedalSubTypes(prev => ({ ...prev, [type]: Number(value) }));
  };

  const addCustomMedalTypeInForm = () => {
    const customType = prompt("ระบุประเภทเหรียญรางวัลพิเศษที่ต้องการเพิ่ม (เช่น ชมเชย, ทองพิเศษ):");
    if (!customType) return;
    const trimmed = customType.trim();
    if (newMedalSubTypes[trimmed] !== undefined) return alert("มีเหรียญประเภทนี้อยู่ในแบบแล้ว");
    setNewMedalSubTypes(prev => ({ ...prev, [trimmed]: 0 }));
  };

  const handleCreateMedal = async (e) => {
    e.preventDefault();
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!newMedalName.trim()) return alert("กรุณากรอกชื่อรุ่น/ปีเหรียญรางวัล");

    const medalKey = newMedalName.trim();
    if (selectedExam.medals?.[medalKey]) return alert("มีเหรียญรางวัลชื่อนี้อยู่แล้ว");

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedMedals = {
      ...selectedExam.medals,
      [medalKey]: { ...newMedalSubTypes }
    };

    await updateDoc(examRef, { medals: updatedMedals, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เพิ่มเหรียญรางวัล",
      details: `เพิ่มเหรียญรางวัลใหม่: "${medalKey}"`, operator, timestamp: serverTimestamp()
    });

    // Reset Form
    setNewMedalName('');
    setNewMedalSubTypes({ ทอง: 0, เงิน: 0, ทองแดง: 0 });
    setShowAddMedalForm(false);
  };

  const handleRenameMedal = async (oldName) => {
    const newName = editMedalName[oldName]?.trim();
    if (!newName || oldName === newName) {
      setEditingMedalKey(null);
      return;
    }
    if (!operator) {
      alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
      setEditingMedalKey(null);
      return;
    }
    if (selectedExam.medals?.[newName]) {
      alert("มีรุ่นเหรียญรางวัลชื่อนี้อยู่แล้ว");
      return;
    }

    try {
      const examRef = doc(db, "exams", selectedExam.id);
      const updatedMedals = { ...selectedExam.medals };
      updatedMedals[newName] = updatedMedals[oldName];
      delete updatedMedals[oldName];

      await updateDoc(examRef, { medals: updatedMedals, updatedAt: serverTimestamp() });
      await addDoc(collection(db, "logs"), {
        examName: selectedExam.examName, action: "เปลี่ยนชื่อเหรียญ",
        details: `เปลี่ยนชื่อเหรียญรางวัลจาก "${oldName}" เป็น "${newName}"`, operator, timestamp: serverTimestamp()
      });
      setEditingMedalKey(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteMedalInDetail = async (medalName) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!window.confirm(`⚠️ ยืนยันการลบเหรียญรางวัล "${medalName}" และจำนวนสต็อกทั้งหมดในรุ่นนี้?`)) return;

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedMedals = { ...selectedExam.medals };
    delete updatedMedals[medalName];

    await updateDoc(examRef, { medals: updatedMedals, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "ลบเหรียญรางวัล",
      details: `ลบเหรียญรางวัล: "${medalName}"`, operator, timestamp: serverTimestamp()
    });
  };

  const addSubMedalTypeInDetail = async (medalName) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    const subType = prompt(`เพิ่มประเภทเหรียญพิเศษสำหรับ "${medalName}" (เช่น ชมเชย, ทองพิเศษ):`);
    if (!subType) return;
    const trimmed = subType.trim();
    if (selectedExam.medals[medalName]?.[trimmed] !== undefined) return alert("มีประเภทเหรียญนี้ในรุ่นนี้อยู่แล้ว");

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedMedals = { ...selectedExam.medals };
    updatedMedals[medalName] = { ...updatedMedals[medalName], [trimmed]: 0 };

    await updateDoc(examRef, { medals: updatedMedals, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เพิ่มประเภทเหรียญรางวัลย่อย",
      details: `เพิ่มประเภทเหรียญย่อย "${trimmed}" ในเหรียญรุ่น "${medalName}"`, operator, timestamp: serverTimestamp()
    });
  };

  const deleteSubMedalTypeInDetail = async (medalName, subType) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!window.confirm(`ลบประเภทเหรียญ "${subType}" ของเหรียญรุ่น "${medalName}"?`)) return;

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedMedals = { ...selectedExam.medals };
    delete updatedMedals[medalName][subType];

    await updateDoc(examRef, { medals: updatedMedals, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "ลบประเภทเหรียญรางวัลย่อย",
      details: `ลบประเภทเหรียญย่อย "${subType}" ในเหรียญรุ่น "${medalName}"`, operator, timestamp: serverTimestamp()
    });
  };

  // ==================== COVERS CRUD ====================
  const handleCreateCover = async (e) => {
    e.preventDefault();
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!newCoverNameForm.trim()) return alert("กรุณากรอกชื่อสี/แบบ Cover");

    const coverKey = newCoverNameForm.trim();
    if (selectedExam.covers?.[coverKey] !== undefined) return alert("มี Cover แบบนี้อยู่แล้ว");

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedCovers = {
      ...selectedExam.covers,
      [coverKey]: Number(newCoverQty)
    };

    await updateDoc(examRef, { covers: updatedCovers, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เพิ่มแบบ Cover",
      details: `เพิ่ม Cover แบบใหม่: "${coverKey}" จำนวน ${newCoverQty} แผ่น`, operator, timestamp: serverTimestamp()
    });

    // Reset Form
    setNewCoverNameForm('');
    setNewCoverQty(0);
    setShowAddCoverForm(false);
  };

  const renameCover = async (oldName) => {
    const newName = editCoverName[oldName];
    if (!newName || oldName === newName) return;
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งาน");
    if (selectedExam.covers?.[newName] !== undefined) return alert("มี Cover แบบนี้อยู่แล้ว");

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedCovers = { ...selectedExam.covers };
    const value = updatedCovers[oldName];

    delete updatedCovers[oldName];
    updatedCovers[newName] = value;

    await updateDoc(examRef, { covers: updatedCovers, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เปลี่ยนชื่อ Cover",
      details: `เปลี่ยนชื่อจาก "${oldName}" เป็น "${newName}"`, operator, timestamp: serverTimestamp()
    });
    setEditCoverName(prev => {
      const n = { ...prev };
      delete n[oldName];
      return n;
    });
  };

  const deleteCoverInDetail = async (colorName) => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    if (!window.confirm(`⚠️ ยืนยันการลบ Cover "${colorName}" และสต็อกทั้งหมด?`)) return;

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedCovers = { ...selectedExam.covers };
    delete updatedCovers[colorName];

    await updateDoc(examRef, { covers: updatedCovers, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "ลบแบบ Cover",
      details: `ลบ Cover แบบ: "${colorName}"`, operator, timestamp: serverTimestamp()
    });
  };

  // ==================== EXAM CREATION ====================
  const handleCreateExam = async () => {
    if (!examName || !operator) return alert("กรุณาระบุชื่อรายการและชื่อผู้ใช้งาน");
    const docId = `${examName}_${Date.now()}`;
    try {
      await setDoc(doc(db, "exams", docId), {
        examName,
        shirts: {},
        medals: {}, // Initialize empty
        covers: {},
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, "logs"), {
        examName, action: "เพิ่มรายการใหม่",
        details: `สร้างการ์ดรายการสอบใหม่: "${examName}"`,
        operator, timestamp: serverTimestamp()
      });
      setShowAddModal(false);
      setExamName('');
    } catch (e) { alert(e.message); }
  };

  const filteredLogs = logs.filter(log => (logFilterExam === 'ทั้งหมด' || log.examName === logFilterExam) && (logFilterAction === 'ทั้งหมด' || log.action === logFilterAction));

  const renderAdjustUI = (category, subCategory, field) => {
    const key = `${category}-${subCategory}-${field}`;
    return (
      <div className="adjust-stock-control">
        <input
          type="number"
          placeholder="0"
          value={adjustAmount[key] || ''}
          onChange={e => setAdjustAmount({ ...adjustAmount, [key]: e.target.value })}
          className="adjust-input"
        />
        <div className="adjust-btns">
          <button onClick={() => quickAdjust(category, subCategory, field, 'add')} className="btn-adjust add">
            <ArrowUpCircle size={12} /> เพิ่ม
          </button>
          <button onClick={() => quickAdjust(category, subCategory, field, 'sub')} className="btn-adjust sub">
            <ArrowDownCircle size={12} /> ลด
          </button>
        </div>
      </div>
    );
  };

  const getYearFilterUI = (keys) => {
    const years = extractYearsFromKeys(keys);
    if (years.length <= 1) return null;
    return (
      <div className="year-filter-group">
        <span className="year-filter-label">เลือกปี:</span>
        {years.map(y => (
          <button
            key={y}
            className={`btn-year ${yearFilter === y ? 'active' : ''} ${y === 'ทั้งหมด' ? 'active-all' : ''}`}
            onClick={() => setYearFilter(y)}
          >
            {y}
          </button>
        ))}
      </div>
    );
  };

  // Render detail tab content
  const renderDetailTabContent = () => {
    if (!selectedExam) return null;

    if (activeTab === 'shirts') {
      const shirtEntries = Object.entries(selectedExam.shirts || {});

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isEditMode && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
              {!showAddShirtForm ? (
                <button onClick={() => setShowAddShirtForm(true)} className="btn-add-small" style={{ fontSize: '1rem' }}>
                  <PlusCircle size={18} /> เพิ่มแบบเสื้อใหม่
                </button>
              ) : null}
            </div>
          )}

          {/* Inline Form to Add New Shirt */}
          {isEditMode && showAddShirtForm && (
            <form onSubmit={handleCreateShirt} className="inline-form-card" style={{ borderLeft: '5px solid var(--theme-shirt)' }}>
              <h4><PlusCircle size={16} /> เพิ่มแบบเสื้อใหม่</h4>
              <div className="inline-form-row">
                <input
                  type="text"
                  placeholder="ชื่อรุ่นเสื้อ เช่น เสื้อวิ่ง 2026"
                  value={newShirtName}
                  onChange={e => setNewShirtName(e.target.value)}
                  className="filter-input"
                  style={{ flex: 1, minWidth: '200px' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-light)' }}>ระบุจำนวนสต็อกเริ่มต้นในแต่ละไซส์ (ถ้ามี):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  {Object.keys(newShirtSizes).map(size => (
                    <div key={size} className="size-input-card">
                      <span style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>{size}</span>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={newShirtSizes[size] || ''}
                        onChange={e => handleSizeQtyChange(size, e.target.value)}
                        style={{ width: '55px', border: 'none', borderLeft: '1px solid var(--color-border)', textAlign: 'center', outline: 'none' }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCustomSizeInForm}
                    className="btn-add-small"
                    style={{ fontSize: '0.85rem', padding: '6px 12px', backgroundColor: '#f0f0f0', borderRadius: '10px' }}
                  >
                    + ไซส์พิเศษ
                  </button>
                </div>
              </div>
              <div className="inline-form-actions">
                <button type="button" onClick={() => setShowAddShirtForm(false)} className="btn-form-cancel">ยกเลิก</button>
                <button type="submit" className="btn-form-save"><Save size={16} /> บันทึกแบบเสื้อ</button>
              </div>
            </form>
          )}

          {shirtEntries.length > 0 ? (
            shirtEntries.map(([type, sizeObj]) => {
              const totalInType = Object.values(sizeObj).reduce((a, b) => a + (Number(b) || 0), 0);
              return (
                <div key={type} className="category-block" style={{ backgroundColor: 'var(--theme-shirt)' }}>
                  <div className="block-title-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Shirt size={20} />
                      {editingShirtKey === type ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="text"
                            className="inline-rename-input"
                            style={{ fontSize: '1.05rem', width: '200px', fontWeight: 'bold' }}
                            value={editShirtName[type] !== undefined ? editShirtName[type] : type}
                            onChange={e => setEditShirtName({ ...editShirtName, [type]: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameShirt(type);
                            }}
                            autoFocus
                          />
                          <button type="button" onClick={() => handleRenameShirt(type)} className="btn-add-small" style={{ fontSize: '0.8rem' }}>
                            <CheckCircle2 size={12} /> ยืนยัน
                          </button>
                          <button type="button" onClick={() => setEditingShirtKey(null)} className="btn-add-small" style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="block-title" style={{ margin: 0 }}>เสื้อ: {type}</p>
                          {isEditMode && (
                            <>
                              <button onClick={() => { setEditingShirtKey(type); setEditShirtName({ ...editShirtName, [type]: type }); }} className="btn-icon-action" title="เปลี่ยนชื่อแบบเสื้อ">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => deleteShirtInDetail(type)} className="btn-icon-action delete" title="ลบแบบเสื้อรุ่นนี้">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {isEditMode && (
                        <button onClick={() => addSizeToShirtInDetail(type)} className="btn-add-small" style={{ fontSize: '0.85rem' }}>
                          + เพิ่มไซส์พิเศษ
                        </button>
                      )}
                      <div className="badge-total">รวมทั้งหมด: {totalInType} ตัว</div>
                    </div>
                  </div>
                  <div className="items-grid">
                    {sortSizes(sizeObj).map(([size, qty]) => (
                      <div key={size} className="item-card-inner">
                        {isEditMode && (
                          <button
                            onClick={() => deleteSizeFromShirtInDetail(type, size)}
                            className="btn-delete-size"
                            title={`ลบไซส์ ${size}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                        <small className="item-label num-font">{size}</small>
                        <div className="item-value num-font">{qty}</div>
                        {isEditMode && renderAdjustUI('shirts', type, size)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-light)' }}>
              ไม่พบข้อมูลเสื้อตามเงื่อนไขที่เลือก
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'medals') {
      const medalEntries = Object.entries(selectedExam.medals || {});
      const filteredMedals = medalEntries.filter(([name]) => {
        const matchYear = yearFilter === 'ทั้งหมด' || name.includes(yearFilter);
        return matchYear;
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isEditMode && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
              {!showAddMedalForm ? (
                <button onClick={() => setShowAddMedalForm(true)} className="btn-add-small" style={{ fontSize: '1rem' }}>
                  <PlusCircle size={18} /> เพิ่มเหรียญรางวัลใหม่
                </button>
              ) : null}
            </div>
          )}

          {/* Inline Form to Add New Medal */}
          {isEditMode && showAddMedalForm && (
            <form onSubmit={handleCreateMedal} className="inline-form-card" style={{ borderLeft: '5px solid var(--theme-medal)' }}>
              <h4><PlusCircle size={16} /> เพิ่มเหรียญรางวัลใหม่</h4>
              <div className="inline-form-row">
                <input
                  type="text"
                  placeholder="ชื่อรุ่นเหรียญรางวัล เช่น เหรียญรางวัลปี 2026"
                  value={newMedalName}
                  onChange={e => setNewMedalName(e.target.value)}
                  className="filter-input"
                  style={{ flex: 1, minWidth: '200px' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-light)' }}>ระบุจำนวนสต็อกเริ่มต้นในแต่ละประเภท (ถ้ามี):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  {Object.keys(newMedalSubTypes).map(type => (
                    <div key={type} className="size-input-card">
                      <span style={{ width: '50px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>{type}</span>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={newMedalSubTypes[type] || ''}
                        onChange={e => handleMedalSubQtyChange(type, e.target.value)}
                        style={{ width: '55px', border: 'none', borderLeft: '1px solid var(--color-border)', textAlign: 'center', outline: 'none' }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCustomMedalTypeInForm}
                    className="btn-add-small"
                    style={{ fontSize: '0.85rem', padding: '6px 12px', backgroundColor: '#f0f0f0', borderRadius: '10px' }}
                  >
                    + ประเภทพิเศษ
                  </button>
                </div>
              </div>
              <div className="inline-form-actions">
                <button type="button" onClick={() => setShowAddMedalForm(false)} className="btn-form-cancel">ยกเลิก</button>
                <button type="submit" className="btn-form-save"><Save size={16} /> บันทึกเหรียญใหม่</button>
              </div>
            </form>
          )}

          {filteredMedals.length > 0 ? (
            filteredMedals.map(([name, medalMap]) => {
              const totalInType = Object.values(medalMap).reduce((a, b) => a + (Number(b) || 0), 0);
              return (
                <div key={name} className="category-block" style={{ backgroundColor: 'var(--theme-medal)' }}>
                  <div className="block-title-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Award size={20} />
                      {editingMedalKey === name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="text"
                            className="inline-rename-input"
                            style={{ fontSize: '1.05rem', width: '200px', fontWeight: 'bold' }}
                            value={editMedalName[name] !== undefined ? editMedalName[name] : name}
                            onChange={e => setEditMedalName({ ...editMedalName, [name]: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameMedal(name);
                            }}
                            autoFocus
                          />
                          <button type="button" onClick={() => handleRenameMedal(name)} className="btn-add-small" style={{ fontSize: '0.85rem' }}>
                            <CheckCircle2 size={12} /> ยืนยัน
                          </button>
                          <button type="button" onClick={() => setEditingMedalKey(null)} className="btn-add-small" style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="block-title" style={{ margin: 0 }}>เหรียญ: {name}</p>
                          {isEditMode && (
                            <>
                              <button onClick={() => { setEditingMedalKey(name); setEditMedalName({ ...editMedalName, [name]: name }); }} className="btn-icon-action" title="เปลี่ยนชื่อเหรียญรางวัล">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => deleteMedalInDetail(name)} className="btn-icon-action delete" title="ลบเหรียญรางวัลรุ่นนี้">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {isEditMode && (
                        <button onClick={() => addSubMedalTypeInDetail(name)} className="btn-add-small" style={{ fontSize: '0.85rem' }}>
                          + เพิ่มประเภทพิเศษ
                        </button>
                      )}
                      <div className="badge-total">รวมทั้งหมด: {totalInType} เหรียญ</div>
                    </div>
                  </div>
                  <div className="items-grid">
                    {sortMedals(medalMap).map(([type, qty]) => (
                      <div key={type} className="item-card-inner">
                        {isEditMode && (
                          <button
                            onClick={() => deleteSubMedalTypeInDetail(name, type)}
                            className="btn-delete-size"
                            title={`ลบประเภท ${type}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                        <small className="item-label">{type}</small>
                        <div className="item-value num-font">{qty}</div>
                        {isEditMode && renderAdjustUI('medals', name, type)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-light)' }}>
              ไม่พบข้อมูลเหรียญรางวัลตามเงื่อนไขที่เลือก
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'covers') {
      const coverEntries = Object.entries(selectedExam.covers || {});
      const filteredCovers = coverEntries.filter(([c]) => {
        const matchYear = yearFilter === 'ทั้งหมด' || c.includes(yearFilter);
        return matchYear;
      });
      const totalCovers = coverEntries.reduce((a, [_, b]) => a + (Number(b) || 0), 0);

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isEditMode && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
              {!showAddCoverForm ? (
                <button onClick={() => setShowAddCoverForm(true)} className="btn-add-small" style={{ fontSize: '1rem' }}>
                  <PlusCircle size={18} /> เพิ่มแบบ Cover
                </button>
              ) : null}
            </div>
          )}

          {/* Inline Form to Add New Cover */}
          {isEditMode && showAddCoverForm && (
            <form onSubmit={handleCreateCover} className="inline-form-card" style={{ borderLeft: '5px solid var(--theme-cover)' }}>
              <h4><PlusCircle size={16} /> เพิ่ม Cover Page ใหม่</h4>
              <div className="inline-form-row">
                <input
                  type="text"
                  placeholder="ชื่อสี/แบบปก เช่น ปกสีชมพู 2026"
                  value={newCoverNameForm}
                  onChange={e => setNewCoverNameForm(e.target.value)}
                  className="filter-input"
                  style={{ flex: 2, minWidth: '200px' }}
                  required
                />
                <input
                  type="number"
                  placeholder="จำนวนเริ่มต้น"
                  min="0"
                  value={newCoverQty || ''}
                  onChange={e => setNewCoverQty(e.target.value)}
                  className="filter-input"
                  style={{ flex: 1, minWidth: '100px' }}
                />
              </div>
              <div className="inline-form-actions">
                <button type="button" onClick={() => setShowAddCoverForm(false)} className="btn-form-cancel">ยกเลิก</button>
                <button type="submit" className="btn-form-save"><Save size={16} /> บันทึก Cover ใหม่</button>
              </div>
            </form>
          )}

          <div className="category-block" style={{ backgroundColor: 'var(--theme-cover)' }}>
            <div className="block-title-row">
              <p className="block-title"><FileText size={20} /> Cover Pages</p>
              <div className="badge-total">รวมทั้งหมด: {totalCovers} แผ่น</div>
            </div>
            <div className="items-grid">
              {filteredCovers.length > 0 ? (
                filteredCovers.map(([c, q]) => (
                  <div key={c} className="item-card-inner">
                    {isEditMode && (
                      <button
                        onClick={() => deleteCoverInDetail(c)}
                        className="btn-delete-size"
                        title={`ลบ Cover ${c}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    {isEditMode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%', position: 'relative' }}>
                        <input
                          className="filter-input"
                          style={{ padding: '6px', fontSize: '0.85rem', textAlign: 'center', width: '85%' }}
                          value={editCoverName[c] !== undefined ? editCoverName[c] : c}
                          onChange={(e) => setEditCoverName({ ...editCoverName, [c]: e.target.value })}
                        />
                        <button onClick={() => renameCover(c)} className="btn-add-small" style={{ fontSize: '0.75rem' }}><CheckCircle2 size={12} /> ยืนยันชื่อ</button>
                      </div>
                    ) : <small className="item-label">{c}</small>}
                    <div className="item-value num-font" style={{ marginTop: isEditMode ? '5px' : '0' }}>{q}</div>
                    {isEditMode && renderAdjustUI('covers', null, c)}
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'var(--color-text-light)' }}>
                  ไม่พบข้อมูล Cover Pages ตามเงื่อนไขที่เลือก
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '50px' }}>
      {/* Header */}
      <div className="app-header">
        <h1>📦 ระบบเช็คของ</h1>
        <div className="header-actions">
          <button onClick={() => setShowAddModal(true)} className="btn-header"><PlusCircle size={20} /> เพิ่มรายการใหม่</button>
          <button onClick={() => setShowLogs(true)} className="btn-header"><History size={20} /> ดูประวัติ (Log)</button>
        </div>
      </div>

      {/* Main Container */}
      <div className="app-container">
        {/* Operator Bar */}
        <div className="operator-bar">
          <span>👤 ผู้ใช้งาน:</span>
          <input placeholder="ชื่อของคุณ..." value={operator} onChange={e => setOperator(e.target.value)} className="operator-input" />
        </div>

        {/* Exams Grid */}
        <div className="cards-grid">
          {exams.map(exam => (
            <div
              key={exam.id}
              onClick={() => {
                setSelectedExam(exam);
                setIsEditMode(false);
                setActiveTab('shirts');
                setYearFilter('ทั้งหมด');
                resetInlineForms();
                setTempExamName(exam.examName); // Init temp exam name on modal open
              }}
              className="exam-card"
            >
              <div className="card-header-row">
                <div className="card-icon"><Package size={24} /></div>
                <button onClick={(e) => handleDeleteExam(e, exam)} className="btn-card-delete"><Trash2 size={16} /></button>
              </div>
              <h3>{exam.examName}</h3>
              <p className="updated-time num-font">ล่าสุด: {exam.updatedAt?.toDate().toLocaleString('th-TH')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {selectedExam && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              {isEditMode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="text"
                    className="inline-rename-input"
                    style={{ fontSize: '1.7rem', fontWeight: 700, width: 'auto', minWidth: '350px' }}
                    value={tempExamName}
                    onChange={(e) => setTempExamName(e.target.value)}
                    onBlur={handleRenameExam}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameExam();
                    }}
                  />
                  <button onClick={handleRenameExam} className="btn-add-small" style={{ fontSize: '0.9rem' }}>
                    <CheckCircle2 size={16} /> ยืนยันชื่อ
                  </button>
                </div>
              ) : (
                <h2>{selectedExam.examName}</h2>
              )}
              <div className="modal-header-actions">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="btn-edit-mode"
                  style={{ backgroundColor: isEditMode ? 'var(--theme-shirt)' : '#f0f0f0' }}
                >
                  <Edit3 size={18} /> {isEditMode ? 'ปิดโหมดแก้ไข' : 'โหมดแก้ไข'}
                </button>
                <button onClick={() => setSelectedExam(null)} className="btn-close"><X size={32} /></button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="modal-tabs">
              <button
                className={`tab-btn ${activeTab === 'shirts' ? 'active' : ''}`}
                onClick={() => { setActiveTab('shirts'); setYearFilter('ทั้งหมด'); resetInlineForms(); }}
              >
                <Shirt size={18} /> เสื้อ
              </button>
              <button
                className={`tab-btn ${activeTab === 'medals' ? 'active' : ''}`}
                onClick={() => { setActiveTab('medals'); setYearFilter('ทั้งหมด'); resetInlineForms(); }}
              >
                <Award size={18} /> เหรียญรางวัล
              </button>
              <button
                className={`tab-btn ${activeTab === 'covers' ? 'active' : ''}`}
                onClick={() => { setActiveTab('covers'); setYearFilter('ทั้งหมด'); resetInlineForms(); }}
              >
                <FileText size={18} /> Cover Pages
              </button>
            </div>

            {/* Smart Filter Bar (Only show if year filters exist) */}
            {((activeTab === 'medals' && extractYearsFromKeys(Object.keys(selectedExam.medals || {})).length > 1) ||
              (activeTab === 'covers' && extractYearsFromKeys(Object.keys(selectedExam.covers || {})).length > 1)) && (
                <div className="filter-bar">
                  {activeTab === 'medals' && getYearFilterUI(Object.keys(selectedExam.medals || {}))}
                  {activeTab === 'covers' && getYearFilterUI(Object.keys(selectedExam.covers || {}))}
                </div>
              )}

            {/* Tab Contents */}
            {renderDetailTabContent()}
          </div>
        </div>
      )}

      {/* Add New Exam Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-add-title">➕ เพิ่มรายการใหม่</h2>
              <button onClick={() => setShowAddModal(false)} className="btn-close"><X size={32} /></button>
            </div>

            <input
              placeholder="ระบุชื่อรายการสอบ/การแข่งขัน"
              value={examName}
              onChange={e => setExamName(e.target.value)}
              className="form-input-large"
            />

            <button onClick={handleCreateExam} className="btn-add-submit"><Save size={20} /> สร้างการ์ดรายการสอบ</button>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px' }}>
            <div className="modal-header">
              <h2><History /> ประวัติสต็อก</h2>
              <button onClick={() => setShowLogs(false)} className="btn-close"><X size={32} /></button>
            </div>

            <div className="log-filter-row">
              <select value={logFilterExam} onChange={e => setLogFilterExam(e.target.value)} className="log-select">
                <option value="ทั้งหมด">รายการสอบ: ทั้งหมด</option>
                {[...new Set(logs.map(l => l.examName))].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={logFilterAction} onChange={e => setLogFilterAction(e.target.value)} className="log-select">
                <option value="ทั้งหมด">ประเภท: ทั้งหมด</option>
                <option value="เพิ่มรายการใหม่">เพิ่มรายการใหม่</option>
                <option value="เพิ่มสต็อก">เพิ่มสต็อก</option>
                <option value="ลดสต็อก">ลดสต็อก</option>
                <option value="เปลี่ยนชื่อ Cover">เปลี่ยนชื่อ Cover</option>
                <option value="เพิ่มช่อง Cover">เพิ่มช่อง Cover</option>
                <option value="ลบรายการ">ลบรายการ</option>
              </select>
            </div>

            <div className="log-table-container scroll-container">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>เวลา</th>
                    <th>รายการ</th>
                    <th>ผู้ทำ</th>
                    <th>รายละเอียดการกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td className="num-font" style={{ fontSize: '0.8rem' }}>{log.timestamp?.toDate().toLocaleString()}</td>
                      <td>{log.examName}</td>
                      <td>{log.operator}</td>
                      <td>{log.action} - {log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;