import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { Music2, LogOut, ShieldCheck, Video, CalendarDays, Users, Plus, Upload, Check, X, RefreshCw, Play, Maximize2, Minimize2 } from 'lucide-react';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const emptyClass = { title: '', style: 'Bachata', level: 0, weekday: 1, start_time: '19:00', teacher: '', is_active: true };

function getYouTubeVideoId(url) {
  return url.match(/(?:youtube\.com\/(?:shorts\/|embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)/)?.[1] || null;
}

function messageFrom(error) {
  if (!error) return '';
  if (error.message?.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (error.message?.includes('Email not confirmed')) return 'Confirma tu correo electrónico y vuelve a iniciar sesión.';
  if (error.message?.toLowerCase().includes('email rate limit exceeded')) {
    return 'Supabase ha limitado temporalmente el envío de correos de registro. Espera antes de volver a intentarlo o configura un proveedor SMTP en Authentication > Email > SMTP Settings en el panel de Supabase.';
  }
  return error.message || 'Ha ocurrido un error inesperado.';
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('myClasses');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [classForm, setClassForm] = useState(emptyClass);
  const [videoForm, setVideoForm] = useState({ class_id: '', title: '', file: null, youtube_url: '' });
  const [videoClassFilter, setVideoClassFilter] = useState('all');
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const routeRef = useRef({ tab: 'myClasses', classId: null });

  const isAdmin = profile?.role === 'admin';

  const loadProfile = useCallback(async (user) => {
    if (!user || !supabase) { setProfile(null); return; }
    const { data, error } = await supabase.from('profiles')
      .select('id, full_name, phone, role').eq('id', user.id).maybeSingle();
    if (error) setNotice(messageFrom(error));
    setProfile(data || null);
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !session?.user) return;
    setBusy(true);
    setNotice('');
    const [c, e, v] = await Promise.all([
      supabase.from('dance_classes').select('*').order('weekday').order('start_time'),
      supabase.from('enrollments').select('id, user_id, class_id, status, created_at, dance_classes(id,title,style,level,weekday,start_time), profiles(id,full_name)').order('created_at', { ascending: false }),
      supabase.from('class_videos').select('id, class_id, title, storage_path, youtube_url, created_at, dance_classes(title,style,level)')
        .order('created_at', { ascending: false })
    ]);
    if (c.error) setNotice(messageFrom(c.error));
    else setClasses(c.data || []);
    if (e.error) setNotice(messageFrom(e.error));
    else setEnrollments(e.data || []);
    if (v.error) setNotice(messageFrom(v.error));
    else setVideos(v.data || []);
    if (isAdmin) {
      const u = await supabase.from('profiles').select('id, full_name, phone, role').order('full_name');
      if (u.error) setNotice(messageFrom(u.error));
      else setUsers(u.data || []);
    }
    setBusy(false);
  }, [session, isAdmin]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) loadProfile(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setTimeout(() => loadProfile(nextSession.user), 0);
      else setProfile(null);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [loadProfile]);

  useEffect(() => { if (session && profile) loadData(); }, [session, profile, loadData]);

  const ownEnrollments = useMemo(
    () => enrollments.filter((e) => e.user_id === session?.user?.id),
    [enrollments, session]
  );
  const enrollmentFor = (classId) => ownEnrollments.find((e) => e.class_id === classId);
  const canSeeVideo = (video) => isAdmin || ownEnrollments.some((e) => e.class_id === video.class_id && e.status === 'approved');
  const activeClasses = classes.filter((danceClass) => danceClass.is_active || isAdmin);
  const myClasses = activeClasses.filter((danceClass) => {
    const enrollment = enrollmentFor(danceClass.id);
    return enrollment && enrollment.status !== 'rejected';
  });
  const visibleClasses = tab === 'myClasses' ? myClasses : activeClasses;
  const selectedClass = classes.find((danceClass) => danceClass.id === selectedClassId);
  const selectedClassVideos = selectedClass
    ? videos.filter((video) => video.class_id === selectedClass.id && canSeeVideo(video))
      .sort((a, b) => a.title.localeCompare(b.title, 'es', { numeric: true }))
    : [];
  const authorizedVideos = videos.filter(canSeeVideo);
  const videoClasses = [...new Map(authorizedVideos.map((video) => [video.class_id, video.dance_classes?.title || 'Clase']))];
  const filteredVideos = authorizedVideos
    .filter((video) => videoClassFilter === 'all' || video.class_id === videoClassFilter)
    .sort((a, b) => (a.dance_classes?.title || '').localeCompare(b.dance_classes?.title || '', 'es')
      || a.title.localeCompare(b.title, 'es', { numeric: true }));

  const navigateTo = useCallback((nextTab, classId = null) => {
    const route = { sycApp: true, tab: nextTab, classId };
    routeRef.current = route;
    window.history.pushState(route, '', window.location.href);
    setTab(nextTab);
    setSelectedClassId(classId);
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !profile) return undefined;

    const initialRoute = { sycApp: true, tab: isAdmin ? 'classes' : 'myClasses', classId: null };
    routeRef.current = initialRoute;
    setTab(initialRoute.tab);
    setSelectedClassId(null);
    window.history.pushState(initialRoute, '', window.location.href);

    function handlePopState(event) {
      const route = event.state?.sycApp
        ? event.state
        : routeRef.current;
      if (!event.state?.sycApp) {
        window.history.pushState({ ...route, sycApp: true }, '', window.location.href);
      }
      routeRef.current = route;
      setTab(route.tab);
      setSelectedClassId(route.classId);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session?.user?.id, profile, isAdmin]);

  async function handleAuth(event) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setNotice('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email.trim(),
          password: authForm.password,
          options: { data: { full_name: authForm.full_name.trim(), phone: authForm.phone.trim() } }
        });
        if (error) throw error;
        setNotice(data.session
          ? 'Cuenta creada. Tu acceso a las clases quedará pendiente de aprobación.'
          : 'Registro recibido. Revisa tu correo para confirmar la cuenta; después podrás iniciar sesión.');
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email.trim(), password: authForm.password
        });
        if (error) throw error;
      }
    } catch (error) { setNotice(messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null); setProfile(null); setClasses([]); setEnrollments([]); setVideos([]);
    setTab('myClasses'); setSelectedClassId(null); setNotice(''); setPlayingVideoId(null); setVideoClassFilter('all');
  }

  async function requestAccess(classId) {
    if (!supabase) return;
    setBusy(true); setNotice('');
    const { error } = await supabase.from('enrollments').insert({
      user_id: session.user.id,
      class_id: classId,
      status: 'pending'
    });
    if (error) setNotice(error.code === '23505' ? 'Ya has solicitado acceso a esta clase.' : messageFrom(error));
    else { setNotice('Solicitud enviada. El equipo de SyC Dance Academy debe aprobarla.'); await loadData(); }
    setBusy(false);
  }

  async function updateEnrollment(id, status) {
    const { error } = await supabase.from('enrollments').update({ status }).eq('id', id);
    setNotice(error ? messageFrom(error) : `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'}.`);
    await loadData();
  }

  async function saveClass(event) {
    event.preventDefault();
    const payload = { ...classForm, level: Number(classForm.level), weekday: Number(classForm.weekday) };
    const { error } = await supabase.from('dance_classes').insert(payload);
    setNotice(error ? messageFrom(error) : 'Clase creada.');
    if (!error) { setClassForm(emptyClass); await loadData(); }
  }

  async function uploadVideo(event) {
    event.preventDefault();
    const youtubeUrl = videoForm.youtube_url.trim();
    const youtubeId = youtubeUrl ? getYouTubeVideoId(youtubeUrl) : null;
    if (!videoForm.class_id) { setNotice('Selecciona una clase.'); return; }
    if (Boolean(videoForm.file) === Boolean(youtubeUrl)) {
      setNotice('Elige un archivo de vídeo o un enlace de YouTube, pero no ambos.');
      return;
    }
    if (youtubeUrl && !youtubeId) {
      setNotice('Introduce un enlace válido de YouTube, por ejemplo youtube.com/shorts/XXXXXXXXXXX.');
      return;
    }
    setBusy(true); setNotice('');
    const file = videoForm.file;
    let storagePath = null;
    try {
      if (file) {
        const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `${videoForm.class_id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('class-videos').upload(storagePath, file, {
          contentType: file.type || 'video/mp4', upsert: false
        });
        if (uploadError) throw uploadError;
      }
      const { error: insertError } = await supabase.from('class_videos').insert({
        class_id: videoForm.class_id,
        title: videoForm.title.trim() || (file ? file.name : 'Vídeo de YouTube'),
        storage_path: storagePath,
        youtube_url: youtubeUrl || null
      });
      if (insertError) {
        if (storagePath) await supabase.storage.from('class-videos').remove([storagePath]);
        throw insertError;
      }
      setNotice(file ? 'Vídeo subido correctamente.' : 'Enlace de YouTube añadido.');
      setVideoForm({ class_id: '', title: '', file: null, youtube_url: '' });
      event.target.reset();
      await loadData();
    } catch (error) { setNotice(messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function openVideo(video) {
    const { data, error } = await supabase.storage.from('class-videos').createSignedUrl(video.storage_path, 60 * 10);
    if (error) { setNotice(messageFrom(error)); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }


  if (!supabase) return <SetupMessage />;
  if (!session) return <AuthScreen authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleAuth={handleAuth} busy={busy} notice={notice} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Music2 size={23} /></div><div><strong>SyC <span>Dance Academy</span></strong><small>Área privada de alumnos</small></div></div>
        <div className="top-actions">
          <span className="user-chip">{profile?.full_name || session.user.email}</span>
          {isAdmin && <span className="admin-pill"><ShieldCheck size={14} /> Administrador</span>}
          <button className="icon-button" onClick={signOut} title="Cerrar sesión"><LogOut size={18} /><span>Salir</span></button>
        </div>
      </header>

      <main className="main-content">
        <section className="welcome">
          <div><p className="eyebrow">BIENVENIDO/A A LA ACADEMIA</p><h1>Tu baile, tu progreso.</h1><p>Consulta tus clases y accede al material que te corresponde.</p></div>
          <div className="welcome-orb"><Music2 size={42} /></div>
        </section>

        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={16} /></button></div>}

        <nav className="tabs">
          {!isAdmin && <button className={tab === 'myClasses' ? 'active' : ''} onClick={() => navigateTo('myClasses')}><CalendarDays size={17} /> Mis clases</button>}
          <button className={tab === 'classes' ? 'active' : ''} onClick={() => navigateTo('classes')}><CalendarDays size={17} /> {isAdmin ? 'Clases' : 'Todas las clases'}</button>
          {isAdmin && <button className={tab === 'videos' ? 'active' : ''} onClick={() => navigateTo('videos')}><Video size={17} /> Vídeos</button>}
          {isAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => navigateTo('admin')}><ShieldCheck size={17} /> Administración</button>}
        </nav>

        {(tab === 'myClasses' || tab === 'classes') && <section>
          {selectedClass ? <>
            <div className="section-heading class-detail-heading">
              <div><button className="subtle-button class-back-button" onClick={() => window.history.back()}>← Volver a {tab === 'myClasses' ? 'mis clases' : 'todas las clases'}</button>
                <h2>{selectedClass.title}</h2><p>{selectedClass.style} · Nivel {selectedClass.level} · {WEEKDAYS[selectedClass.weekday - 1]} · {String(selectedClass.start_time).slice(0,5)}</p>
              </div>
            </div>
            {enrollmentFor(selectedClass.id)?.status === 'pending' && <div className="notice" role="status">Tu solicitud para esta clase está pendiente de aprobación. Los vídeos estarán disponibles cuando se apruebe.</div>}
            {selectedClassVideos.length === 0
              ? <Empty text={enrollmentFor(selectedClass.id)?.status === 'approved' || isAdmin ? 'Todavía no hay vídeos publicados para esta clase.' : 'Cuando se apruebe tu acceso, podrás ver aquí los vídeos de esta clase.'} />
              : <div className="video-grid">{selectedClassVideos.map((video) => <article className="video-card" key={video.id}>
                  {video.youtube_url ? <YouTubePlayer video={video} playing={playingVideoId === video.id} onPlay={() => setPlayingVideoId(video.id)} /> : <div className="video-art"><Video size={30} /></div>}
                  <div className="video-info"><span className="style-pill">{selectedClass.style}</span><h3>{video.title}</h3>
                    {!video.youtube_url && <button className="primary-button full" onClick={() => openVideo(video)}>Ver vídeo</button>}
                  </div>
                </article>)}</div>}
          </> : <>
          <div className="section-heading"><div><h2>{tab === 'myClasses' ? 'Mis clases' : 'Horario de clases'}</h2><p>{tab === 'myClasses' ? 'Tus clases y el material de cada una.' : 'Explora las clases disponibles y solicita acceso.'}</p></div>
            <button className="subtle-button" onClick={loadData}><RefreshCw size={15} /> Actualizar</button>
          </div>
          {visibleClasses.length === 0
            ? <div className="empty-state"><div><Music2 size={24}/></div><p>{tab === 'myClasses' ? 'Aún no tienes clases. Explora el horario y solicita acceso a las clases que tienes contratadas.' : 'Todavía no hay clases publicadas. El administrador puede añadirlas desde Administración.'}</p>
                {tab === 'myClasses' && <button className="primary-button catalog-cta" onClick={() => setTab('classes')}>Ver todas las clases</button>}
              </div>
            :
            <div className="class-grid">{visibleClasses.map(c => {
              const enrollment = enrollmentFor(c.id);
              return <article className="class-card" key={c.id}>
                <div className="class-card-top"><span className="style-pill">{c.style}</span><span className="level-pill">Nivel {c.level}</span></div>
                <h3>{c.title}</h3>
                <p className="class-meta"><CalendarDays size={15} /> {WEEKDAYS[c.weekday - 1]} · {String(c.start_time).slice(0,5)}</p>
                <p className="teacher">{c.teacher ? `Profesor/a: ${c.teacher}` : 'Profesor/a por confirmar'}</p>
                {enrollment?.status === 'approved' ? <span className="status approved"><Check size={15} /> Acceso aprobado</span>
                  : enrollment?.status === 'pending' ? <span className="status pending">Solicitud pendiente</span>
                  : enrollment?.status === 'rejected' && <span className="status rejected">Solicitud rechazada</span>}
                {enrollment?.status === 'approved' && <button className="primary-button full class-open-button" onClick={() => navigateTo(tab, c.id)}>Entrar a la clase</button>}
                {tab === 'myClasses' && enrollment?.status === 'pending' && <button className="primary-button full class-open-button" onClick={() => navigateTo(tab, c.id)}>Ver clase</button>}
                {tab === 'classes' && enrollment?.status !== 'approved' && enrollment?.status !== 'pending' && <button className="primary-button full" disabled={busy} onClick={() => requestAccess(c.id)}>{enrollment?.status === 'rejected' ? 'Volver a solicitar acceso' : 'Solicitar acceso'}</button>}
              </article>;
            })}</div>}
          </>}
        </section>}

        {tab === 'videos' && isAdmin && <section>
          <div className="section-heading video-library-heading"><div><h2>Biblioteca de vídeos</h2><p>Solo se muestran los vídeos de clases con acceso aprobado.</p></div>
            {videoClasses.length > 1 && <label className="video-filter">Filtrar por clase<select value={videoClassFilter} onChange={e=>setVideoClassFilter(e.target.value)}><option value="all">Todas las clases</option>{videoClasses.map(([id, title])=><option value={id} key={id}>{title}</option>)}</select></label>}
          </div>
          {authorizedVideos.length === 0 ? <Empty text="Aún no tienes vídeos disponibles. Cuando se apruebe tu acceso a una clase, aparecerá aquí su material." /> :
            <div className="video-grid">{filteredVideos.map(v => <article className="video-card" key={v.id}>
              {v.youtube_url ? <YouTubePlayer video={v} playing={playingVideoId === v.id} onPlay={() => setPlayingVideoId(v.id)} /> : <div className="video-art"><Video size={30} /></div>}
              <div className="video-info"><span className="style-pill">{v.dance_classes?.style || 'Clase'}</span><h3>{v.title}</h3><p>{v.dance_classes?.title || ''}</p>
                {!v.youtube_url && <button className="primary-button full" onClick={() => openVideo(v)}>Ver vídeo</button>}
              </div>
            </article>)}</div>}
        </section>}

        {tab === 'admin' && isAdmin && <section>
          <div className="section-heading"><div><h2>Administración</h2><p>Gestiona solicitudes, clases y material de la academia.</p></div></div>
          <div className="admin-stats"><div><Users /><span><strong>{users.length}</strong> perfiles</span></div><div><CalendarDays /><span><strong>{classes.length}</strong> clases</span></div><div><Video /><span><strong>{videos.length}</strong> vídeos</span></div></div>
          <div className="admin-grid">
            <div className="panel"><h3>Solicitudes de acceso</h3>
              {enrollments.length === 0 ? <p className="muted">No hay solicitudes todavía.</p> : <div className="request-list">{enrollments.map(e => <div className="request-row" key={e.id}>
                <div><strong>{e.profiles?.full_name || 'Alumno/a'}</strong><p>{e.dance_classes?.title || 'Clase'} · {e.dance_classes?.weekday ? WEEKDAYS[e.dance_classes.weekday - 1] : ''} {e.dance_classes?.start_time?.slice(0,5) || ''}</p><span className={`status-text ${e.status}`}>{e.status === 'approved' ? 'Aprobada' : e.status === 'pending' ? 'Pendiente' : 'Rechazada'}</span></div>
                <div className="row-actions">{e.status !== 'approved' && <button className="approve-button" onClick={() => updateEnrollment(e.id, 'approved')} title="Aprobar"><Check size={16} /></button>}{e.status !== 'rejected' && <button className="reject-button" onClick={() => updateEnrollment(e.id, 'rejected')} title="Rechazar"><X size={16} /></button>}</div>
              </div>)}</div>}
            </div>
            <div className="panel"><h3>Añadir una clase</h3>
              <form className="stack-form" onSubmit={saveClass}>
                <label>Nombre de la clase<input required value={classForm.title} onChange={e=>setClassForm({...classForm,title:e.target.value})} placeholder="Bachata 1" /></label>
                <div className="form-two"><label>Estilo<select value={classForm.style} onChange={e=>setClassForm({...classForm,style:e.target.value})}>{['Bachata','Salsa Cubana','Salsa Línea','Kizomba','Otros'].map(s=><option key={s}>{s}</option>)}</select></label><label>Nivel<select value={classForm.level} onChange={e=>setClassForm({...classForm,level:Number(e.target.value)})}>{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>
                <div className="form-two"><label>Día<select value={classForm.weekday} onChange={e=>setClassForm({...classForm,weekday:Number(e.target.value)})}>{WEEKDAYS.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label><label>Hora<input required type="time" value={classForm.start_time} onChange={e=>setClassForm({...classForm,start_time:e.target.value})} /></label></div>
                <label>Profesor/a<input value={classForm.teacher} onChange={e=>setClassForm({...classForm,teacher:e.target.value})} placeholder="Nombre del profesor/a" /></label>
                <button className="primary-button" type="submit"><Plus size={16} /> Crear clase</button>
              </form>
            </div>
            <div className="panel"><h3>Añadir vídeo</h3><p className="muted">Sube un archivo privado o añade un enlace de YouTube.</p>
              <form className="stack-form" onSubmit={uploadVideo}>
                <label>Clase<select required value={videoForm.class_id} onChange={e=>setVideoForm({...videoForm,class_id:e.target.value})}><option value="">Selecciona una clase</option>{classes.map(c=><option value={c.id} key={c.id}>{c.title} · {WEEKDAYS[c.weekday-1]} {c.start_time?.slice(0,5)}</option>)}</select></label>
                <label>Título del vídeo<input value={videoForm.title} onChange={e=>setVideoForm({...videoForm,title:e.target.value})} placeholder="Combinación de hoy" /></label>
                <label>Enlace de YouTube<input type="url" inputMode="url" value={videoForm.youtube_url} onChange={e=>setVideoForm({...videoForm,youtube_url:e.target.value,file:null})} placeholder="https://youtube.com/shorts/…" /></label>
                <label>O archivo de vídeo<input type="file" accept="video/*" onChange={e=>setVideoForm({...videoForm,file:e.target.files?.[0] || null,youtube_url:''})} /></label>
                <button className="primary-button" type="submit" disabled={busy}><Upload size={16} /> Añadir vídeo</button>
              </form>
            </div>
            <div className="panel"><h3>Perfiles y roles</h3><p className="muted">Los roles se asignan deliberadamente desde SQL para evitar que la interfaz permita elevar privilegios por error.</p>
              <div className="request-list">{users.map(u=><div className="request-row" key={u.id}><div><strong>{u.full_name || 'Sin nombre'}</strong><p>{u.phone || 'Sin teléfono'}</p></div><span className={`status-text ${u.role === 'admin' ? 'approved' : 'pending'}`}>{u.role === 'admin' ? 'Administrador' : 'Alumno'}</span></div>)}</div>
            </div>
          </div>
        </section>}
      </main>
      <footer className="footer">SyC Dance Academy <span>·</span> Baila, aprende, evoluciona.</footer>
    </div>
  );
}

function AuthScreen({ authMode, setAuthMode, authForm, setAuthForm, handleAuth, busy, notice }) {
  const signup = authMode === 'signup';
  return <main className="auth-layout"><section className="auth-visual"><div className="brand brand-light"><div className="brand-mark"><Music2 size={23}/></div><div><strong>SyC <span>Dance Academy</span></strong><small>Conecta con tu ritmo</small></div></div><div className="auth-copy"><p className="eyebrow">TU COMUNIDAD DE BAILE</p><h1>El siguiente paso<br/>empieza en la pista.</h1><p>Clases, técnica y vídeos para seguir evolucionando, dentro y fuera de la academia.</p></div><div className="auth-decoration">SyC <span>·</span> DANCE <span>·</span> COMMUNITY</div></section>
    <section className="auth-panel"><div className="auth-form-wrap"><div className="mobile-brand brand"><div className="brand-mark"><Music2 size={23}/></div><div><strong>SyC <span>Dance Academy</span></strong><small>Área privada de alumnos</small></div></div><p className="eyebrow">{signup ? 'ÚNETE A LA ACADEMIA' : 'QUÉ BUENO VERTE'}</p><h2>{signup ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p className="muted">{signup ? 'Regístrate y solicita acceso a tus clases.' : 'Accede a tus clases y vídeos autorizados.'}</p>
    {notice && <div className="notice">{notice}</div>}
    <form className="stack-form auth-form" onSubmit={handleAuth}>
      {signup && <><label>Nombre y apellidos<input required autoComplete="name" value={authForm.full_name} onChange={e=>setAuthForm({...authForm,full_name:e.target.value})} placeholder="Tu nombre completo" /></label><label>Teléfono<input type="tel" autoComplete="tel" value={authForm.phone} onChange={e=>setAuthForm({...authForm,phone:e.target.value})} placeholder="Tu teléfono" /></label></>}
      <label>Correo electrónico<input required type="email" autoComplete="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="tu@correo.com" /></label>
      <label>Contraseña<input required type="password" minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="Mínimo 8 caracteres" /></label>
      <button className="primary-button full auth-submit" type="submit" disabled={busy}>{busy ? 'Un momento…' : signup ? 'Crear cuenta' : 'Entrar'} </button>
    </form><p className="switch-auth">{signup ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'} <button onClick={()=>{setAuthMode(signup?'login':'signup');}}>{signup ? 'Inicia sesión' : 'Regístrate'}</button></p><p className="auth-privacy">El acceso a clases y vídeos requiere aprobación de la academia.</p></div></section></main>;
}

function Empty({ text }) { return <div className="empty-state"><div><Music2 size={24}/></div><p>{text}</p></div>; }

function YouTubePlayer({ video, playing, onPlay }) {
  const playerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const videoId = getYouTubeVideoId(video.youtube_url);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === playerRef.current);
    }

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  async function toggleFullscreen() {
    const player = playerRef.current;
    if (!player) return;

    setFullscreenError('');
    try {
      if (document.fullscreenElement === player) {
        await document.exitFullscreen();
      } else if (player.requestFullscreen) {
        await player.requestFullscreen();
      } else {
        setFullscreenError('Este navegador no permite ampliar el reproductor incrustado.');
      }
    } catch {
      setFullscreenError('No se pudo activar la pantalla completa. Prueba desde los controles de YouTube.');
    }
  }

  if (!videoId) return <div className="video-art"><Video size={30} /></div>;

  if (playing) {
    return <div className="youtube-player" ref={playerRef}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&controls=1&fs=1`}
        title={video.title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
      />
      <button
        className="youtube-fullscreen-button"
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
        title={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
      >
        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
      {fullscreenError && <p className="youtube-fullscreen-error" role="status">{fullscreenError}</p>}
    </div>;
  }

  return <button className="youtube-preview" type="button" onClick={onPlay} aria-label={`Reproducir ${video.title}`}>
    <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
    <span className="youtube-play"><Play size={25} fill="currentColor" /></span>
  </button>;
}

function SetupMessage() {
  return <div className="setup-screen"><div className="brand"><div className="brand-mark"><Music2 size={23}/></div><div><strong>SyC <span>Dance Academy</span></strong><small>Configuración inicial</small></div></div><h1>Conecta tu proyecto de Supabase</h1><p>Crea un archivo <code>.env.local</code> en la raíz del proyecto con la URL y la clave publicable de Supabase. Después reinicia el servidor de desarrollo.</p><pre>{'VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co\\nVITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_SB_PUBLISHABLE'}</pre><p>Consulta <code>README.md</code> para los pasos completos. No uses una clave <code>sb_secret_</code> ni <code>service_role</code> en el navegador.</p></div>;
}
