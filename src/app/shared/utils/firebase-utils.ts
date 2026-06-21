
import {
    collection, 
    doc, 
    setDoc, 
    updateDoc, 
    getDocs, 
    getDoc,
    deleteDoc, 
    addDoc, 
    query, 
    where, 
    limit, 
    writeBatch,
    runTransaction
} from 'firebase/firestore';
import { collectionData } from '@angular/fire/firestore';
import { uploadBytes, getDownloadURL, ref as storageRef } from '@angular/fire/storage';
import { signInWithEmailAndPassword, updatePassword, signOut, sendPasswordResetEmail, updateProfile, authState, createUserWithEmailAndPassword } from '@angular/fire/auth';

export const FbUtils = {
    uploadBytes: (ref: any, data: any, metadata?: any) => uploadBytes(ref, data, metadata),
    getDownloadURL: (ref: any) => getDownloadURL(ref),
    ref: (storage: any, path: string) => storageRef(storage, path), 
    collection, 
    doc, 
    setDoc, 
    updateDoc, 
    getDocs,
    getDoc,
    deleteDoc, 
    addDoc, 
    query, 
    where, 
    limit, 
    writeBatch,
    runTransaction,
    collectionData,
    signInWithEmailAndPassword,
    updatePassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    authState,
    createUserWithEmailAndPassword
};
