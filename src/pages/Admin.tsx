import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Trash2, Edit, Save, X, LayoutDashboard, Database, Users, Upload, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { googleProvider, getStoredDriveToken } from '../firebase/config';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export default function Admin() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompts' | 'users'>('prompts');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    is_vip: false,
    category: 'Marketing',
    image_url: ''
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      is_vip: false,
      category: 'Marketing',
      image_url: ''
    });
    setEditingId(null);
    setIsAdding(false);
  };

  useEffect(() => {
    // Load stored token if available
    const storedToken = getStoredDriveToken();
    if (storedToken) {
      setDriveToken(storedToken);
    }

    let profileUnsub: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (user) {
        const profilePath = `profiles/${user.uid}`;
        profileUnsub = onSnapshot(doc(db, 'profiles', user.uid), (doc) => {
          const data = doc.data();
          if (data?.status === 'admin') {
            setIsAdmin(true);
          } else {
            navigate('/');
          }
        }, (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, profilePath);
          }
        });
      } else {
        navigate('/');
      }
    });

    const promptsPath = 'prompts';
    const q = query(collection(db, promptsPath), orderBy('createdAt', 'desc'));
    const unsubPrompts = onSnapshot(q, (snapshot) => {
      setPrompts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, promptsPath);
    });

    const usersPath = 'profiles';
    const unsubUsers = onSnapshot(collection(db, usersPath), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, usersPath);
      }
    });

    return () => {
      unsubAuth();
      unsubPrompts();
      unsubUsers();
      if (profileUnsub) profileUnsub();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptsPath = 'prompts';
    try {
      if (editingId) {
        await updateDoc(doc(db, promptsPath, editingId), {
          ...formData,
          createdAt: serverTimestamp() // Update timestamp on edit too if desired or keep original
        });
        MySwal.fire({
          title: 'อัปเดตสำเร็จ!',
          text: 'ข้อมูล Prompt ถูกแก้ไขเรียบร้อยแล้วครับ',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await addDoc(collection(db, promptsPath), {
          ...formData,
          createdAt: serverTimestamp()
        });
        MySwal.fire({
          title: 'เพิ่มข้อมูลสำเร็จ!',
          text: 'Prompt ใหม่ถูกเพิ่มเข้าสู่ระบบแล้วครับ',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `${promptsPath}/${editingId}` : promptsPath);
      MySwal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองอีกครั้งครับ',
        icon: 'error',
        confirmButtonColor: '#D4AF37'
      });
    }
  };

  const handleEdit = (prompt: any) => {
    setFormData({
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      is_vip: prompt.is_vip,
      category: prompt.category,
      image_url: prompt.image_url || ''
    });
    setEditingId(prompt.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!id) return;
    
    // Find the prompt first to check for image cleanup
    const promptToDelete = prompts.find(p => p.id === id);
    let driveFileId: string | null = null;
    if (promptToDelete?.image_url?.includes('lh3.googleusercontent.com/d/')) {
      driveFileId = promptToDelete.image_url.split('/').pop() || null;
    }

    if (driveFileId) {
      const result = await MySwal.fire({
        title: 'ยืนยันการลบไฟล์ภาพ?',
        text: 'Prompt นี้มีการเชื่อมโยงไฟล์ภาพใน Google Drive อยู่ด้วย คุณต้องการลบไฟล์ภาพใน Drive ทิ้งด้วยหรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ลบไฟล์ใน Drive ด้วย',
        cancelButtonText: 'เก็บไฟล์ไว้ (ลบแค่ Prompt)',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151'
      });
      
      if (result.isConfirmed) {
        await deleteFileFromDrive(driveFileId);
      }
    }

    console.log("Processing delete for ID:", id);
    const path = `prompts/${id}`;
    try {
      await deleteDoc(doc(db, 'prompts', id));
      setConfirmDeleteId(null);
      console.log("Delete success");
      MySwal.fire({
        title: 'ลบสำเร็จ!',
        text: 'ข้อมูล Prompt ถูกลบออกจากระบบแล้วครับ',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Delete error:", error);
      handleFirestoreError(error, OperationType.DELETE, path);
      MySwal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถลบข้อมูลได้ โปรดลองอีกครั้งครับ',
        icon: 'error',
        confirmButtonColor: '#D4AF37'
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newStatus: string) => {
    const path = `profiles/${userId}`;
    try {
      await updateDoc(doc(db, 'profiles', userId), {
        status: newStatus
      });
      MySwal.fire({
        title: 'อัปเดตสถานะสำเร็จ',
        text: `เปลี่ยนสถานะผู้ใช้เป็น ${newStatus.toUpperCase()} แล้วครับ`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      MySwal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถอัปเดตสถานะผู้ใช้ได้ครับ',
        icon: 'error'
      });
    }
  };

  const handleResetUserQuota = async (userId: string) => {
    const path = `profiles/${userId}`;
    try {
      await updateDoc(doc(db, 'profiles', userId), {
        usage_count: 0
      });
      MySwal.fire({
        title: 'รีเซ็ตโควตาสำเร็จ',
        text: 'พอยท์การใช้งานของผู้ใช้ถูกรีเซ็ตเป็น 0 แล้วครับ',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      MySwal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถรีเซ็ตโควตาได้ครับ',
        icon: 'error'
      });
    }
  };

  const getDriveToken = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveToken(credential.accessToken);
        sessionStorage.setItem('google_drive_token', credential.accessToken);
        return credential.accessToken;
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        MySwal.fire({
          title: 'หน้าต่าง Pop-up ถูกบล็อก',
          text: 'โปรดอนุญาตให้เปิด Pop-up สำหรับเว็บไซต์นี้ (จากแถบ URL ด้านบน) แล้วลองใหม่อีกครั้งครับ',
          icon: 'warning',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#D4AF37'
        });
      } else {
        console.error("Error getting Drive token:", error);
        MySwal.fire({
          title: 'เกิดข้อผิดพลาด',
          text: 'โปรดเข้าสู่ระบบและอนุญาตสิทธิ์ Google Drive เพื่ออัปโหลดครับ',
          icon: 'error',
          confirmButtonColor: '#D4AF37'
        });
      }
    }
    return null;
  };

  const DRIVE_FOLDER_ID = '18m8JjFnw6YkbVZ0ReW--6kFWxmBAiLLs';

  const deleteFileFromDrive = async (fileId: string) => {
    try {
      let token = driveToken;
      if (!token) token = await getDriveToken();
      if (!token) return false;

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok || res.status === 404;
    } catch (err) {
      console.error("Drive delete error:", err);
      return false;
    }
  };

  const handleDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!driveToken) {
      MySwal.fire({
        title: 'ยังไม่ได้เชื่อมต่อ Drive',
        text: 'โปรดคลิกปุ่ม "CONNECT DRIVE" ก่อนทำการอัปโหลดครับ',
        icon: 'info',
        confirmButtonColor: '#D4AF37'
      });
      return;
    }

    if (isUploading) return;

    // Check if we are replacing an existing Drive file
    const currentUrl = formData.image_url || '';
    const driveMatch = currentUrl.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    const oldFileId = driveMatch ? driveMatch[1] : null;

    if (oldFileId) {
      const result = await MySwal.fire({
        title: 'พบรูปภาพเดิมใน Drive',
        text: 'คุณต้องการลบภาพเดิมและแทนที่ด้วยภาพใหม่ใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ลบและแทนที่',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#D4AF37',
        cancelButtonColor: '#374151'
      });
      
      if (!result.isConfirmed) {
        e.target.value = '';
        return;
      }
    }

    setIsUploading(true);
    const token = driveToken;

    try {
      console.log("Starting Drive upload for:", file.name);
      
      const metadata = {
        name: `${Date.now()}-${file.name}`,
        parents: [DRIVE_FOLDER_ID],
        mimeType: file.type
      };

      const googleFormData = new FormData();
      googleFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      googleFormData.append('file', file);

      // 1. Upload File
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: googleFormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
      }
      
      const fileData = await response.json();
      const fileId = fileData.id;
      console.log("File uploaded successfully, ID:", fileId);

      // 2. Set Public Permissions
      const permResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });

      if (!permResponse.ok) {
        console.warn("Permission update might have failed for file:", fileId);
      }

      // 3. Delete old file if exists
      if (oldFileId) {
        console.log("Deleting old file from Drive:", oldFileId);
        await deleteFileFromDrive(oldFileId);
      }

      // 4. Set the direct URL
      const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      setFormData(prev => ({ ...prev, image_url: directUrl }));
      MySwal.fire({
        title: 'สำเร็จ!',
        text: 'อัปโหลดรูปภาพไปยัง Google Drive เรียบร้อยแล้วครับ',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error("Drive upload error detail:", error);
      if (error.message?.includes('disabled') || error.message?.includes('not been used')) {
        MySwal.fire({
          title: 'Drive API Disabled',
          text: 'Google Drive API ยังไม่ได้ถูกเปิดใช้งานในโปรเจกต์ของคุณ โปรดไปที่ Google Cloud Console และกดปุ่ม "ENABLE" เพื่ออนุญาตใช้งานครับ',
          icon: 'error',
          confirmButtonColor: '#D4AF37'
        });
      } else {
        MySwal.fire({
          title: 'อัปโหลดไม่สำเร็จ',
          text: `เกิดข้อผิดพลาด: ${error.message}`,
          icon: 'error',
          confirmButtonColor: '#D4AF37'
        });
      }
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (loading) return null;
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 gold-gradient rounded-3xl flex items-center justify-center shadow-2xl shadow-gold/20">
            <Shield className="h-8 w-8 text-black" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-black text-white">MASTER PANEL</h1>
            <div className="flex gap-4 mt-2">
              <button 
                onClick={() => setActiveTab('prompts')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-colors",
                  activeTab === 'prompts' ? "text-gold" : "text-white/40 hover:text-white"
                )}
              >
                Prompts
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-colors",
                  activeTab === 'users' ? "text-gold" : "text-white/40 hover:text-white"
                )}
              >
                Users
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => isAdding ? resetForm() : setIsAdding(true)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl px-8 py-4 font-bold transition-all active:scale-95",
            isAdding ? "bg-white/10 text-white" : "gold-gradient text-black"
          )}
        >
          {isAdding ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {isAdding ? 'CANCEL' : 'ADD NEW PROMPT'}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Stats or Form */}
        <div className="lg:col-span-8">
          {activeTab === 'prompts' ? (
            <>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-8 mb-12"
                >
                  <h2 className="font-display text-2xl font-bold mb-8">
                    {editingId ? 'Edit Prompt Details' : 'New Prompt Details'}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Title</label>
                        <input
                          required
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white focus:outline-none focus:ring-1 focus:ring-gold"
                          placeholder="e.g. Master Copywriting Framework"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white focus:outline-none focus:ring-1 focus:ring-gold"
                        >
                          {['Marketing', 'Creative', 'Technical', 'Business', 'Productivity'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Short Description</label>
                      <input
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white focus:outline-none focus:ring-1 focus:ring-gold"
                        placeholder="Briefly explain what this prompt does"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Image Content (Google Drive)</label>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                          {!driveToken ? (
                            <button
                              type="button"
                              onClick={getDriveToken}
                              className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold border border-gold/30 gold-gradient-text hover:bg-gold/10 transition-all h-14 bg-white/5"
                            >
                              <Shield className="h-5 w-5 text-gold" />
                              <span className="text-sm uppercase tracking-wider">CONNECT DRIVE</span>
                            </button>
                          ) : (
                            <label className={cn(
                              "flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold border-2 border-dashed border-white/10 hover:border-gold/50 cursor-pointer transition-all h-14",
                              isUploading && "opacity-50 pointer-events-none"
                            )}>
                              {isUploading ? (
                                <RefreshCw className="h-5 w-5 animate-spin text-gold" />
                              ) : (
                                <Upload className="h-5 w-5 text-white/40" />
                              )}
                              <span className="text-sm font-bold uppercase tracking-wider">
                                {isUploading ? 'UPLOADING...' : 'UPLOAD TO DRIVE'}
                              </span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleDriveUpload}
                                disabled={isUploading}
                              />
                            </label>
                          )}
                          <div className="flex-1 flex flex-col gap-1">
                             <input
                               value={formData.image_url}
                               onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                               className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white focus:outline-none focus:ring-1 focus:ring-gold text-sm"
                               placeholder="Or paste direct image URL..."
                             />
                             <p className="text-[10px] text-white/40 uppercase tracking-widest">Direct link preferred for optimal display</p>
                          </div>
                        </div>
                        {formData.image_url && (
                          <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 group">
                            <img src={formData.image_url} className="w-full h-full object-cover" alt="Preview" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                              <p className="text-[10px] text-white/60 px-4 text-center truncate w-full font-mono mb-2">{formData.image_url}</p>
                              <div className="flex gap-2">
                                <button 
                                  type="button"
                                  onClick={async () => {
                                    if (formData.image_url.includes('lh3.googleusercontent.com/d/')) {
                                      const fileId = formData.image_url.split('/').pop();
                                      if (fileId) {
                                        const result = await MySwal.fire({
                                          title: 'ลบไฟล์ออกจาก Drive ด้วยหรือไม่?',
                                          text: 'รูปภาพนี้อยู่ใน Google Drive คุณต้องการลบไฟล์ออกจาก Drive ทันทีด้วยหรือไม่? (หากยกเลิกจะเป็นเพียงการลบลิงก์ออกจาก Prompt เท่านั้น)',
                                          icon: 'warning',
                                          showCancelButton: true,
                                          confirmButtonText: 'ลบทิ้งถาวร',
                                          cancelButtonText: 'ลบเฉพาะลิงก์',
                                          confirmButtonColor: '#ef4444',
                                          cancelButtonColor: '#374151'
                                        });

                                        if (result.isConfirmed) {
                                          await deleteFileFromDrive(fileId);
                                        }
                                      }
                                    }
                                    setFormData(prev => ({ ...prev, image_url: '' }));
                                  }}
                                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                                >
                                  REMOVE FROM PROMPT
                                </button>
                                {formData.image_url.includes('lh3.googleusercontent.com/d/') && (
                                  <button 
                                    type="button"
                                    onClick={async () => {
                                      const fileId = formData.image_url.split('/').pop();
                                      if (!fileId) return;

                                      const result = await MySwal.fire({
                                        title: 'ยืนยันการลบไฟล์จาก Drive?',
                                        text: 'คุณต้องการลบไฟล์นี้ออกจาก Google Drive อย่างถาวรใช่หรือไม่?',
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonText: 'ใช่, ลบทิ้งเลย',
                                        cancelButtonText: 'ยกเลิก',
                                        confirmButtonColor: '#ef4444',
                                        cancelButtonColor: '#374151'
                                      });

                                      if (result.isConfirmed) {
                                        const success = await deleteFileFromDrive(fileId);
                                        if (success) {
                                          setFormData(prev => ({ ...prev, image_url: '' }));
                                          MySwal.fire({
                                            title: 'สำเร็จ',
                                            text: 'ลบไฟล์จาก Drive เรียบร้อย',
                                            icon: 'success',
                                            timer: 1500,
                                            showConfirmButton: false
                                          });
                                        } else {
                                          MySwal.fire({
                                            title: 'ไม่สำเร็จ',
                                            text: 'ไม่สามารถลบไฟล์จาก Drive ได้ครับ',
                                            icon: 'error',
                                            confirmButtonColor: '#D4AF37'
                                          });
                                        }
                                      }
                                    }}
                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-lg text-xs font-bold transition-all"
                                  >
                                    DELETE FROM DRIVE
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Prompt Content</label>
                      <textarea
                        required
                        rows={6}
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white focus:outline-none focus:ring-1 focus:ring-gold"
                        placeholder="Paste the full AI prompt here..."
                      />
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                      <input
                        type="checkbox"
                        id="is_vip"
                        checked={formData.is_vip}
                        onChange={(e) => setFormData({ ...formData, is_vip: e.target.checked })}
                        className="h-5 w-5 rounded accent-gold"
                      />
                      <label htmlFor="is_vip" className="text-sm font-bold text-white uppercase tracking-wider">Mark as VIP Content</label>
                    </div>

                    <button type="submit" className="gold-gradient w-full rounded-2xl py-5 font-black text-black text-lg shadow-2xl shadow-gold/30">
                      {editingId ? 'UPDATE PROMPT' : 'PUBLISH TO LIBRARY'}
                    </button>
                  </form>
                </motion.div>
              )}

              <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <Database className="h-5 w-5 text-gold" />
                    Live Collections
                  </h3>
                  <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-white/60">
                    {prompts.length} ITEMS
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {prompts.map(p => (
                    <div key={p.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={p.image_url || `https://picsum.photos/seed/${p.id}/100/100`} className="h-12 w-12 rounded-lg object-cover" />
                        <div>
                          <h4 className="font-bold text-white leading-none mb-1">{p.title}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">{p.category}</span>
                            {p.is_vip && <span className="h-1 w-1 bg-gold rounded-full" />}
                            {p.is_vip && <span className="text-[10px] font-bold text-gold/60">VIP</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {confirmDeleteId === p.id ? (
                          <div className="flex items-center gap-2 bg-red-500/10 p-1 rounded-xl border border-red-500/20">
                            <button 
                              onClick={() => handleDelete(p.id)}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                            >
                              ยืนยันการลบ
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 text-white/60 text-xs font-bold hover:text-white transition-colors"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              type="button"
                              onClick={() => handleEdit(p)}
                              className="p-3 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-xl"
                              title="แก้ไข"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)} 
                              className="p-3 text-white/40 hover:text-red-500 transition-colors bg-white/5 hover:bg-red-500/10 rounded-xl"
                              title="ลบ"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-gold" />
                  User Directory
                </h3>
                <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-white/60">
                  {users.length} USERS
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {users.map(u => (
                  <div key={u.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                    <div>
                      <h4 className="font-bold text-white leading-none mb-1">{u.email || 'Anonymous'}</h4>
                      <p className="text-xs text-white/40 mb-2">UID: {u.id}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
                          {['free', 'vip', 'admin'].map(s => (
                            <button
                              key={s}
                              onClick={() => handleUpdateUserRole(u.id, s)}
                              className={cn(
                                "px-3 py-1 text-[10px] font-bold uppercase tracking-tighter rounded-md transition-all",
                                u.status === s ? "bg-gold text-black" : "text-white/40 hover:text-white"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div>
                        <div className="text-xl font-black text-white">{u.usage_count || 0}</div>
                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Usage</div>
                      </div>
                      <button 
                        onClick={() => handleResetUserQuota(u.id)}
                        className="text-[10px] font-bold bg-white/10 px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        RESET QUOTA
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dashboard Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-gold" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="text-2xl font-black text-gold">{prompts.length}</div>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total Prompts</div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="text-2xl font-black text-gold">24%</div>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">VIP Ratio</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              System Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Database Engine</span>
                <span className="text-xs font-bold text-gold">FIRESTORE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Auth Provider</span>
                <span className="text-xs font-bold text-gold">GOOGLE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Access Tier</span>
                <span className="text-xs font-bold text-gold">ENTERPRISE</span>
              </div>
              <div className="pt-4 border-t border-white/10 mt-4">
                <div className="flex items-center gap-2 text-gold">
                  <div className="h-2 w-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">System Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
