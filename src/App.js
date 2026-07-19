import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc, query, orderBy, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import { Plus, Minus, History, X, Save, Edit3, Calendar, Package, PlusCircle, Trash2, CheckCircle2, Filter, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const COLORS = {
  bg: '#FDFCF0',
  header: '#E2F0CB',
  shirt: '#FFD1DC',
  medal: '#FFF5BA',
  cover: '#B2E2F2',
  text: '#555',
  success: '#88AB8E',
  danger: '#FFB3BA'
};

const SIZE_RANK = { "XS": 1, "S": 2, "M": 3, "L": 4, "XL": 5, "XXL": 6, "3XL": 7, "4XL": 8, "5XL": 9 };
const DEFAULT_SIZES = { "XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "3XL": 0 };

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

  const [logFilterExam, setLogFilterExam] = useState('ทั้งหมด');
  const [logFilterAction, setLogFilterAction] = useState('ทั้งหมด');

  const [examName, setExamName] = useState('');
  const [shirtRows, setShirtRows] = useState([{ type: '', sizes: [{ label: 'XS', qty: 0 }, { label: 'S', qty: 0 }, { label: 'M', qty: 0 }, { label: 'L', qty: 0 }, { label: 'XL', qty: 0 }, { label: 'XXL', qty: 0 }, { label: '3XL', qty: 0 }] }]);
  const [medals, setMedals] = useState({ ทอง: 0, เงิน: 0, ทองแดง: 0 });
  const [covers, setCovers] = useState([{ color: '', qty: 0 }]);

  useEffect(() => {
    const q = query(collection(db, "exams"), orderBy("updatedAt", "desc"));
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

  const addShirtRow = () => {
    setShirtRows([...shirtRows, { type: '', sizes: [{ label: 'XS', qty: 0 }, { label: 'S', qty: 0 }, { label: 'M', qty: 0 }, { label: 'L', qty: 0 }, { label: 'XL', qty: 0 }, { label: 'XXL', qty: 0 }, { label: '3XL', qty: 0 }] }]);
  };
  const removeShirtRow = (idx) => setShirtRows(shirtRows.filter((_, i) => i !== idx));
  const addSizeToRow = (idx) => {
    const n = [...shirtRows];
    n[idx].sizes.push({ label: '', qty: 0 });
    setShirtRows(n);
  };
  const removeSizeFromRow = (rIdx, sIdx) => {
    const n = [...shirtRows];
    n[rIdx].sizes = n[rIdx].sizes.filter((_, i) => i !== sIdx);
    setShirtRows(n);
  };

  const sortSizes = (sizeObj) => {
    return Object.entries(sizeObj).sort(([a], [b]) => (SIZE_RANK[a.toUpperCase()] || 99) - (SIZE_RANK[b.toUpperCase()] || 99));
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

  const addNewCoverInDetail = async () => {
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งานก่อน");
    const newColorName = prompt("ระบุชื่อสี/แบบ Cover ที่ต้องการเพิ่ม:");
    if (!newColorName) return;

    const examRef = doc(db, "exams", selectedExam.id);
    const updatedCovers = { ...selectedExam.covers, [newColorName]: 0 };

    await updateDoc(examRef, { covers: updatedCovers, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      examName: selectedExam.examName, action: "เพิ่มช่อง Cover",
      details: `เพิ่ม Cover แบบใหม่: "${newColorName}" ในหน้ารายละเอียด`, operator, timestamp: serverTimestamp()
    });
  };

  const renameCover = async (oldName) => {
    const newName = editCoverName[oldName];
    if (!newName || oldName === newName) return;
    if (!operator) return alert("กรุณาระบุชื่อผู้ใช้งาน");

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
        const n = {...prev};
        delete n[oldName];
        return n;
    });
  };

  const handleFullAdd = async () => {
    if (!examName || !operator) return alert("กรุณาระบุชื่อรายการและชื่อผู้ใช้งาน");
    const docId = `${examName}_${Date.now()}`;
    const shirtMap = {};
    shirtRows.forEach(r => {
      if (!r.type) return;
      const sMap = {};
      r.sizes.forEach(s => { if (s.label) sMap[s.label] = Number(s.qty); });
      shirtMap[r.type] = sMap;
    });
    const coverMap = {};
    covers.forEach(c => { if (c.color) coverMap[c.color] = Number(c.qty); });

    try {
      await setDoc(doc(db, "exams", docId), { examName, shirts: shirtMap, medals, covers: coverMap, updatedAt: serverTimestamp() });
      await addDoc(collection(db, "logs"), {
        examName, action: "เพิ่มรายการใหม่", details: `เพิ่มข้อมูลของ ${examName} โดยมีเสื้อ ${Object.keys(shirtMap).length} แบบ เหรียญ และ cover`, operator, timestamp: serverTimestamp()
      });
      setShowAddModal(false);
      setExamName(''); setShirtRows([{ type: '', sizes: [{ label: 'XS', qty: 0 }, { label: 'S', qty: 0 }, { label: 'M', qty: 0 }, { label: 'L', qty: 0 }, { label: 'XL', qty: 0 }, { label: 'XXL', qty: 0 }, { label: '3XL', qty: 0 }] }]);
      setMedals({ ทอง: 0, เงิน: 0, ทองแดง: 0 }); setCovers([{ color: '', qty: 0 }]);
    } catch (e) { alert(e.message); }
  };

  const filteredLogs = logs.filter(log => (logFilterExam === 'ทั้งหมด' || log.examName === logFilterExam) && (logFilterAction === 'ทั้งหมด' || log.action === logFilterAction));

  const renderAdjustUI = (category, subCategory, field) => {
    const key = `${category}-${subCategory}-${field}`;
    return (
      <div style={quickEditContainer}>
        <input type="number" placeholder="0" value={adjustAmount[key] || ''} onChange={e => setAdjustAmount({...adjustAmount, [key]: e.target.value})} style={newQuickInput} />
        <div style={buttonGroup}>
          <button onClick={() => quickAdjust(category, subCategory, field, 'add')} style={newAddBtn}><ArrowUpCircle size={12}/> เพิ่ม</button>
          <button onClick={() => quickAdjust(category, subCategory, field, 'sub')} style={newSubBtn}><ArrowDownCircle size={12}/> ลด</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', fontFamily: "'Kanit', sans-serif", paddingBottom: '50px' }}>
      <div style={{ backgroundColor: COLORS.header, padding: '40px 20px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: 0 }}>📦 ระบบเช็คของ</h2>
        <div style={{display:'flex', justifyContent:'center', gap:'12px', marginTop:'20px'}}>
            <button onClick={() => setShowAddModal(true)} style={mainAddBtn}><PlusCircle size={20} /> เพิ่มรายการใหม่</button>
            <button onClick={() => setShowLogs(true)} style={historyBtn}><History size={20} /> ดูประวัติ (Log)</button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
        <div style={operatorBar}>👤 ผู้ใช้งาน: <input placeholder="ชื่อของคุณ..." value={operator} onChange={e => setOperator(e.target.value)} style={minimalInput} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {exams.map(exam => (
            <div key={exam.id} onClick={() => { setSelectedExam(exam); setIsEditMode(false); }} style={examCard}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <div style={iconBox}><Package size={24} color="#666" /></div>
                <button onClick={(e) => handleDeleteExam(e, exam)} style={deleteBtnCard}><Trash2 size={16} /></button>
              </div>
              <h3 style={{ margin: '15px 0 5px' }}>{exam.examName}</h3>
              <p style={{color:'#888', fontSize:'13px'}}>ล่าสุด: {exam.updatedAt?.toDate().toLocaleString('th-TH')}</p>
            </div>
          ))}
        </div>
      </div>

      {selectedExam && (
        <div style={modalOverlay}>
          <div style={modalContentWide}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', borderBottom: '2px solid #f8f8f8', paddingBottom: '15px' }}>
              <h2 style={{margin:0}}>{selectedExam.examName}</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIsEditMode(!isEditMode)} style={{...editBtn, backgroundColor: isEditMode ? COLORS.shirt : '#f0f0f0'}}><Edit3 size={18} /> {isEditMode ? 'ปิดการแก้ไข' : 'แก้ไขจำนวน'}</button>
                <button onClick={() => setSelectedExam(null)} style={closeBtn}><X size={32} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {(Object.keys(selectedExam.shirts || {}).length > 0 ? Object.entries(selectedExam.shirts) : [['ไม่มีข้อมูลเสื้อ', DEFAULT_SIZES]]).map(([type, sizeObj]) => {
                const totalInType = Object.values(sizeObj).reduce((a, b) => a + (Number(b) || 0), 0);
                return (
                  <div key={type} style={{ ...blockStyle, backgroundColor: COLORS.shirt }}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', alignItems:'center'}}>
                      <p style={sectionTitle}>👕 เสื้อ: {type}</p>
                      <div style={totalBadge}>รวมทั้งหมด: {totalInType} ตัว</div>
                    </div>
                    <div style={wideRowLayout}>
                      {sortSizes(sizeObj).map(([size, qty]) => (
                        <div key={size} style={itemCellWide}>
                          <small style={labelStyle}>{size}</small>
                          <div style={cellValue}>{qty}</div>
                          {isEditMode && renderAdjustUI('shirts', type, size)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px'}}>
                <div style={{ ...blockStyle, backgroundColor: COLORS.medal }}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', alignItems:'center'}}>
                        <p style={sectionTitle}>🏅 เหรียญรางวัล</p>
                        <div style={totalBadge}>
                            รวมทั้งหมด: {Object.values(selectedExam.medals || {}).reduce((a, b) => a + (Number(b) || 0), 0)} เหรียญ
                        </div>
                    </div>
                    <div style={wideRowLayout}>{Object.entries(selectedExam.medals || {"ทอง":0,"เงิน":0,"ทองแดง":0}).map(([t, q]) => (
                      <div key={t} style={itemCellWide}><small style={labelStyle}>{t}</small><div style={cellValue}>{q}</div>{isEditMode && renderAdjustUI('medals', null, t)}</div>
                    ))}</div>
                </div>

                <div style={{ ...blockStyle, backgroundColor: COLORS.cover }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <p style={sectionTitle}>📄 Cover Pages</p>
                        {isEditMode && <button onClick={addNewCoverInDetail} style={addSmallBtn}><PlusCircle size={16}/> เพิ่มแบบ Cover</button>}
                    </div>
                    <div style={wideRowLayout}>
                      {Object.entries(selectedExam.covers || {}).length > 0 ? Object.entries(selectedExam.covers).map(([c, q]) => (
                        <div key={c} style={itemCellWide}>
                          {isEditMode ? (
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', width:'100%'}}>
                                <input style={renameInput} value={editCoverName[c] !== undefined ? editCoverName[c] : c} onChange={(e) => setEditCoverName({...editCoverName, [c]: e.target.value})} />
                                <button onClick={() => renameCover(c)} style={renameBtn}><CheckCircle2 size={12}/> ยันยันชื่อ</button>
                            </div>
                          ) : <small style={labelStyle}>{c}</small>}
                          <div style={cellValue}>{q}</div>
                          {isEditMode && renderAdjustUI('covers', null, c)}
                        </div>
                      )) : (
                        <div style={itemCellWide}><small style={labelStyle}>-</small><div style={cellValue}>0</div>{isEditMode && renderAdjustUI('covers', null, 'ไม่มีชื่อ')}</div>
                      )}
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={modalOverlay}>
          <div style={modalContentWide}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}><h3>➕ เพิ่มรายการใหม่</h3><button onClick={() => setShowAddModal(false)} style={closeBtn}><X size={32}/></button></div>
            <input placeholder="ชื่อรายการสอบ" value={examName} onChange={e => setExamName(e.target.value)} style={{...inputStyle, width:'100%', marginBottom:'20px'}} />
            <div style={{ ...blockStyle, backgroundColor: COLORS.shirt, marginBottom:'20px' }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}><p style={sectionTitle}>👕 เสื้อ (เพิ่มแบบและไซส์เอง)</p><button onClick={addShirtRow} style={addSmallBtn}><PlusCircle size={18}/> เพิ่มแบบเสื้อ</button></div>
              {shirtRows.map((row, idx) => (
                <div key={idx} style={dynamicRowContainer}>
                  <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'10px'}}>
                    <input placeholder="รุ่นเสื้อ" value={row.type} onChange={e => { const n = [...shirtRows]; n[idx].type = e.target.value; setShirtRows(n); }} style={{...inputStyle, flex:1}} />
                    <button onClick={() => addSizeToRow(idx)} style={addSmallBtn}>+ไซส์</button>
                    {shirtRows.length > 1 && <button onClick={() => removeShirtRow(idx)} style={{color:'#FFB3BA', border:'none', background:'none', cursor:'pointer'}}><Trash2 size={20}/></button>}
                  </div>
                  <div style={wideRowLayout}>{row.sizes.map((s, sIdx) => (
                    <div key={sIdx} style={sizeInputGroup}>
                      <input placeholder="ไซส์" value={s.label} onChange={e => { const n = [...shirtRows]; n[idx].sizes[sIdx].label = e.target.value; setShirtRows(n); }} style={sizeLabelIn} />
                      <input type="number" value={s.qty} onChange={e => { const n = [...shirtRows]; n[idx].sizes[sIdx].qty = Number(e.target.value); setShirtRows(n); }} style={sizeQtyIn} />
                      <button onClick={() => removeSizeFromRow(idx, sIdx)} style={removeSizeBtn}><X size={12}/></button>
                    </div>
                  ))}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px' }}>
                <div style={{ ...blockStyle, backgroundColor: COLORS.medal }}><p style={sectionTitle}>🏅 เหรียญรางวัล</p>
                    <div style={wideRowLayout}>{['ทอง', 'เงิน', 'ทองแดง'].map(t => <div key={t} style={itemCellWide}><small>{t}</small><input type="number" value={medals[t]} onChange={e => setMedals({...medals, [t]: Number(e.target.value)})} style={miniInput} /></div>)}</div>
                </div>
                <div style={{ ...blockStyle, backgroundColor: COLORS.cover }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:'15px' }}><p style={sectionTitle}>📄 Cover Pages</p><button onClick={() => setCovers([...covers, { color: '', qty: 0 }])} style={addSmallBtn}><PlusCircle size={18}/> เพิ่มสี</button></div>
                    {covers.map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                          <input placeholder="สี" value={c.color} onChange={e => { const n = [...covers]; n[i].color = e.target.value; setCovers(n); }} style={{...miniInput, width:'120px', textAlign:'left'}} />
                          <input type="number" value={c.qty} onChange={e => { const n = [...covers]; n[i].qty = Number(e.target.value); setCovers(n); }} style={miniInput} />
                          <button onClick={() => setCovers(covers.filter((_,idx)=>idx!==i))} style={{border:'none', background:'none', color:'#FFB3BA', cursor:'pointer'}}><Trash2 size={18}/></button>
                        </div>
                    ))}
                </div>
            </div>
            <button onClick={handleFullAdd} style={saveFullBtn}><Save size={24} /> บันทึกรายการใหม่</button>
          </div>
        </div>
      )}

      {showLogs && (
        <div style={modalOverlay}>
            <div style={{...modalContentWide, maxWidth:'1000px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}><h2><History /> ประวัติสต็อก</h2><button onClick={() => setShowLogs(false)} style={closeBtn}><X size={32}/></button></div>
                <div style={filterBar}>
                    <select value={logFilterExam} onChange={e => setLogFilterExam(e.target.value)} style={selectFilter}>
                        <option value="ทั้งหมด">รายการสอบ: ทั้งหมด</option>
                        {[...new Set(logs.map(l => l.examName))].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select value={logFilterAction} onChange={e => setLogFilterAction(e.target.value)} style={selectFilter}>
                        <option value="ทั้งหมด">ประเภท: ทั้งหมด</option>
                        <option value="เพิ่มรายการใหม่">เพิ่มรายการใหม่</option>
                        <option value="เพิ่มสต็อก">เพิ่มสต็อก</option>
                        <option value="ลดสต็อก">ลดสต็อก</option>
                        <option value="เปลี่ยนชื่อ Cover">เปลี่ยนชื่อ Cover</option>
                        <option value="เพิ่มช่อง Cover">เพิ่มช่อง Cover</option>
                        <option value="ลบรายการ">ลบรายการ</option>
                    </select>
                </div>
                <div style={logListScroll}><table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead><tr style={{textAlign:'left', background:'#f9f9f9'}}><th style={{padding:'12px'}}>เวลา</th><th>รายการ</th><th>ผู้ทำ</th><th>การกระทำ</th></tr></thead>
                    <tbody>{filteredLogs.map(log => (<tr key={log.id} style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'12px', fontSize:'12px'}}>{log.timestamp?.toDate().toLocaleString()}</td><td>{log.examName}</td><td>{log.operator}</td><td>{log.action} - {log.details}</td></tr>))}</tbody>
                </table></div>
            </div>
        </div>
      )}
    </div>
  );
}

const totalBadge = { background:'#fff', padding:'4px 12px', borderRadius:'10px', fontSize:'13px', fontWeight:'bold', color:'#333', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' };
const renameInput = { width:'80px', padding:'3px', borderRadius:'5px', border:'1px solid #ccc', fontSize:'11px', textAlign:'center', outline:'none' };
const renameBtn = { background:COLORS.success, color:'#fff', border:'none', borderRadius:'4px', padding:'2px 6px', fontSize:'9px', cursor:'pointer' };
const quickEditContainer = { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '125px' };
const newQuickInput = { width: '110px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', fontSize: '14px', outline: 'none' };
const buttonGroup = { display: 'flex', gap: '4px', width: '100%' };
const newAddBtn = { flex: 1, background: COLORS.header, border: 'none', padding: '8px 4px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' };
const newSubBtn = { flex: 1, background: COLORS.shirt, border: 'none', padding: '8px 4px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' };
const deleteBtnCard = { background: 'rgba(255,179,186,0.2)', border: 'none', borderRadius: '10px', padding: '8px', color: '#FFB3BA', cursor: 'pointer' };
const operatorBar = { display:'flex', alignItems:'center', gap:'10px', marginBottom:'25px', background:'#fff', padding:'15px 25px', borderRadius:'20px', width:'fit-content', boxShadow:'0 2px 8px rgba(0,0,0,0.03)' };
const minimalInput = { border: 'none', borderBottom: '2px solid #E2F0CB', background: 'none', padding: '5px', outline: 'none', width: '180px', fontSize:'16px' };
const examCard = { backgroundColor: '#fff', padding: '25px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', cursor: 'pointer', textAlign: 'center' };
const iconBox = { backgroundColor: COLORS.header, width: '45px', height: '45px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContentWide = { backgroundColor: '#fff', padding: '40px', borderRadius: '40px', width: '95%', maxWidth: '1250px', maxHeight: '92vh', overflowY: 'auto' };
const wideRowLayout = { display: 'flex', flexWrap: 'wrap', gap: '10px' };
const itemCellWide = { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: '25px', minWidth: '100px' };
const labelStyle = { color: '#888', fontWeight: 'bold', fontSize: '12px', marginBottom:'5px' };
const cellValue = { fontSize: '28px', fontWeight: 'bold', color: '#444' };
const blockStyle = { padding: '25px', borderRadius: '35px' };
const sectionTitle = { margin: '0', fontWeight: 'bold', fontSize: '16px', color: 'rgba(0,0,0,0.6)' };
const inputStyle = { padding: '12px 18px', borderRadius: '15px', border: '1px solid #eee', fontSize: '16px', outline:'none' };
const miniInput = { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #fff', textAlign: 'center', outline:'none' };
const saveFullBtn = { width: '100%', padding: '20px', borderRadius: '25px', border: 'none', backgroundColor: COLORS.success, color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', marginTop:'15px' };
const mainAddBtn = { padding: '14px 25px', borderRadius: '30px', border: 'none', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '8px' };
const historyBtn = { padding: '14px 25px', borderRadius: '30px', border: 'none', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '8px' };
const addSmallBtn = { border: 'none', background: 'none', color: COLORS.success, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight:'bold' };
const editBtn = { border: 'none', padding: '10px 20px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'8px' };
const closeBtn = { border: 'none', background: 'none', cursor: 'pointer', color: '#ccc' };
const logListScroll = { maxHeight: '450px', overflowY: 'auto' };
const dynamicRowContainer = { backgroundColor:'rgba(255,255,255,0.4)', padding:'20px', borderRadius:'20px', marginBottom:'15px' };
const sizeInputGroup = { display:'flex', alignItems:'center', background:'#fff', borderRadius:'10px', padding:'5px', border:'1px solid #eee' };
const sizeLabelIn = { width:'50px', border:'none', borderRight:'1px solid #eee', textAlign:'center', outline:'none', fontWeight:'bold' };
const sizeQtyIn = { width:'55px', border:'none', textAlign:'center', outline:'none' };
const removeSizeBtn = { background:'#FFB3BA', border:'none', borderRadius:'50%', width:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'5px', color:'#fff' };
const filterBar = { background:'#f9f9f9', padding:'15px', borderRadius:'15px', marginBottom:'15px', display:'flex', gap:'10px' };
const selectFilter = { padding:'8px', borderRadius:'10px', border:'1px solid #ddd' };

export default App;