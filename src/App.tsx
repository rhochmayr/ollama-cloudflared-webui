import React, { useEffect, useState } from 'react';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { supabase } from './lib/supabase';
import { useChatStore } from './lib/store';

function App() {
  const [session, setSession] = useState<any>(null);
  const init = useChatStore(state => state.init);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        init();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        init();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {!session ? <Auth /> : <Chat />}
    </div>
  );
}

export default App;