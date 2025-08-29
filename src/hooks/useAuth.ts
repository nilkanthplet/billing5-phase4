import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface UserWithRole extends User {
  isAdmin: boolean
}

export function useAuth() {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAdminRole = (user: User | null): UserWithRole | null => {
    if (!user) return null
    return {
      ...user,
      isAdmin: user.email === 'nilkanthplatdepo@gmail.com'
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(checkAdminRole(session?.user ?? null))
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(checkAdminRole(session?.user ?? null))
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (data?.user) {
      console.log('Sign in successful for user:', data.user.email)
    }
    
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (data?.user) {
      console.log('Sign up successful for user:', data.user.email)
    }
    
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      console.log('Sign out successful')
    }
    return { error }
  }

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }
}