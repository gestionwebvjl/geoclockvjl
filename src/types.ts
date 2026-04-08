import { useState, useEffect } from 'react';

export interface User {
  id: number;
  email: string;
  password?: string;
  name: string;
  employee_id: string;
  department: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'OFF';
  position?: string;
  joined_at?: string;
  avatar_url?: string;
}

export interface Worksite {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  radius: number;
  is_active: boolean;
}

export interface Record {
  id: number;
  user_id: number;
  user_name?: string;
  worksite_id: number;
  worksite_name?: string;
  type: 'IN' | 'OUT';
  timestamp: string;
  notes: string;
  latitude: number;
  longitude: number;
  distance: number;
  is_manual?: boolean;
  audit_log?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export function useGeolocation() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocalización no soportada");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { location, error };
}
