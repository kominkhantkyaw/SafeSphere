import React, { useState } from 'react';
import { Icons } from './Icon';
import type { DrillSession } from '../types';

interface RegisterDrillModalProps {
    drill: DrillSession;
    /** Pre-selected slot when opened from calendar click */
    initialSlot?: { date: string; time: string };
    onRegister: (drill: DrillSession, slot: { date: string; time: string }) => void;
    onClose: () => void;
    t: (key: string) => string;
}

/** Get selectable slots - use slots array if present, else single slot from date+time */
const getSlots = (drill: DrillSession): { date: string; time: string }[] => {
    if (drill.slots && drill.slots.length > 0) {
        return drill.slots.map(s => ({ date: s.date, time: s.time }));
    }
    return [{ date: drill.date, time: drill.time || '09:00' }];
};

const formatSlotLabel = (date: string, time: string): string => {
    try {
        const d = new Date(date + 'T' + time);
        return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + time;
    } catch {
        return `${date} ${time}`;
    }
};

type ModalStep = 'select' | 'confirm' | 'success';

export const RegisterDrillModal: React.FC<RegisterDrillModalProps> = ({ drill, initialSlot, onRegister, onClose, t }) => {
    const slots = getSlots(drill);
    const defaultSlot = initialSlot && slots.some(s => s.date === initialSlot.date && s.time === initialSlot.time)
        ? initialSlot
        : slots[0];
    const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string }>(defaultSlot);
    const [step, setStep] = useState<ModalStep>('select');

    const handleBookClick = (e: React.FormEvent) => {
        e.preventDefault();
        setStep('confirm');
    };

    const handleConfirmBooking = () => {
        onRegister(drill, selectedSlot);
        setStep('success');
    };

    const handleSuccessOk = () => onClose();

    const handleBack = () => setStep('select');

    const successMessage = (t('bookingSuccessMessage') || 'You have {title} booked successfully.').replace('{title}', drill.title);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg">{drill.title}</h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label={t('close')}>
                        <Icons.X size={20} />
                    </button>
                </div>

                {step === 'select' && (
                    <>
                        <p className="text-sm text-gray-600 mb-4">
                            {t('selectPreferredSession') || 'Select your preferred session date and time:'}
                        </p>
                        <form onSubmit={handleBookClick} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    {t('availableSessions') || 'Available Sessions'}
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {slots.map((slot, idx) => (
                                        <label
                                            key={idx}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                                                selectedSlot.date === slot.date && selectedSlot.time === slot.time
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="slot"
                                                checked={selectedSlot.date === slot.date && selectedSlot.time === slot.time}
                                                onChange={() => setSelectedSlot(slot)}
                                                className="sr-only"
                                            />
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                selectedSlot.date === slot.date && selectedSlot.time === slot.time ? 'border-blue-500' : 'border-gray-300'
                                            }`}>
                                                {selectedSlot.date === slot.date && selectedSlot.time === slot.time && (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                )}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-900">{formatSlotLabel(slot.date, slot.time)}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl">
                                    {t('cancel')}
                                </button>
                                <button type="submit" className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
                                    {t('book') || 'Book'}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {step === 'confirm' && (
                    <>
                        <p className="text-sm text-gray-600 mb-4">
                            {(t('confirmBookingMessage') || 'Confirm your booking for {title} on {slot}?')
                                .replace('{title}', drill.title)
                                .replace('{slot}', formatSlotLabel(selectedSlot.date, selectedSlot.time))}
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            {t('confirmBookingNotifyHint') || 'A confirmation notification will be sent to your email and via notification alert.'}
                        </p>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleBack} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl">
                                {t('changeSelection') || 'Change selection'}
                            </button>
                            <button type="button" onClick={handleConfirmBooking} className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
                                {t('confirm') || 'Confirm'}
                            </button>
                        </div>
                    </>
                )}

                {step === 'success' && (
                    <>
                        <div className="py-4 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                                <Icons.CheckCircle size={28} />
                            </div>
                            <p className="text-base font-medium text-gray-900">{successMessage}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleSuccessOk}
                            className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                        >
                            {t('ok') || 'OK'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
