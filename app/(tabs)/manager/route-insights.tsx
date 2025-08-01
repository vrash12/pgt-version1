// app/manager/route-insights.tsx  –  Bus ▸ Date ▸ Trip
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BACKEND = 'http://192.168.1.7:5000';

/* ────── types ────── */
interface TimePoint { time:string; passengers?:number; tickets?:number; revenue?:number }
interface Bus       { id:number;  identifier:string }
interface Trip      { id:number;  number:string; start_time:string; end_time:string; route_id?:number }

/* helper */
const fmtHHMM = (d:Date)=>dayjs(d).format('HH:mm');

export default function RouteInsights() {
  const router = useRouter();

  /* picks */
  const [date,   setDate]   = useState(new Date());
  const [buses,  setBuses]  = useState<Bus[]>([]);
  const [busId,  setBusId]  = useState<number>();
  const [trips,  setTrips]  = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<number>();
  const [tripTimes,setTripTimes] = useState<{start:string,end:string}|null>(null);
  const [routeId, setRouteId] = useState<number>();          // derived later

  /* modals */
  const [showDate,setShowDate] = useState(false);

  /* time window (defaults 1 h) */
  const [startTime,setStart] = useState(dayjs().startOf('hour').toDate());
  const [endTime,  setEnd]   = useState(dayjs().startOf('hour').add(1,'hour').toDate());

  /* data / flags */
  const [loading,setLoading] = useState(false);
  const [occ,setOcc] = useState<TimePoint[]>([]);
  const [tix,setTix] = useState<TimePoint[]>([]);

  /* ─── 1. load *all* buses once ─── */
  useEffect(()=>{
    (async()=>{
      try{
        const tok = await AsyncStorage.getItem('@token');
        const res = await fetch(`${BACKEND}/manager/buses`,
                                { headers: tok ? {Authorization:`Bearer ${tok}`} : {} });
        setBuses(await res.json());
      }catch(e){ console.error('[RouteInsights] bus list error',e); }
    })();
  },[]);

  /* ─── 2. load trips any time BUS *or* DATE changes ─── */
  useEffect(()=>{
    if(!busId){ setTrips([]); setTripId(undefined); return; }
    (async()=>{
      try{
        const tok   = await AsyncStorage.getItem('@token');
        const day   = dayjs(date).format('YYYY-MM-DD');
        const url   = `${BACKEND}/manager/bus-trips?bus_id=${busId}&date=${day}`;
        const trips = await (await fetch(url,{ headers:tok?{Authorization:`Bearer ${tok}`}:{}})).json();
        setTrips(trips);
        if (trips.length) {
             setTripId(trips[0].id);
             setTripTimes({ start: trips[0].start_time, end: trips[0].end_time });
           }
        if(trips[0]?.route_id) setRouteId(trips[0].route_id);
      }catch(e){ console.error('[RouteInsights] trip list error',e); }
    })();
  },[busId,date]);

  /* ─── 3. fetch insights ─── */
  const fetchInsights = async ()=>{
    if(!busId || !tripId || !routeId) return;
    setLoading(true);
    try{
      const tok = await AsyncStorage.getItem('@token');
      const qs  = new URLSearchParams({
        date: dayjs(date).format('YYYY-MM-DD'),
         trip_id:String(tripId),
         ...(tripId ? {} : {                 // fallback – keep window mode working
             from:fmtHHMM(startTime),
             to:  fmtHHMM(endTime)
         })
      });
      const res = await fetch(`${BACKEND}/manager/route-insights?${qs}`,
                              { headers:tok?{Authorization:`Bearer ${tok}`}:{} });
      const j   = await res.json();
      setOcc(j.occupancy||[]); setTix(j.tickets||[]);
    }catch(e){ console.error('[RouteInsights] insights error',e); }
    finally  { setLoading(false); }
  };

  /* simple KPIs */
  const avgPax   = occ.length?Math.round(occ.reduce((s,x)=>s+(x.passengers||0),0)/occ.length):0;
  const totTix   = tix.reduce((s,x)=>s+(x.tickets||0),0);
  const totRev   = tix.reduce((s,x)=>s+(x.revenue||0),0);
  const timeline = occ.map(o=>({ time:o.time, passengers:o.passengers,
                                 tickets:tix.find(t=>t.time===o.time)?.tickets||0 }));

  return(
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff"/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Route Data Insights</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom:32}} showsVerticalScrollIndicator={false}>

        {/* KPI */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiBox}><Text style={styles.kpiVal}>{avgPax}</Text><Text style={styles.kpiLbl}>Avg Pax</Text></View>
          <View style={styles.divider}/>
          <View style={styles.kpiBox}><Text style={styles.kpiVal}>{totTix}</Text><Text style={styles.kpiLbl}>Tickets</Text></View>
          <View style={styles.divider}/>
          <View style={styles.kpiBox}><Text style={styles.kpiVal}>{totRev.toFixed(0)}</Text><Text style={styles.kpiLbl}>₱ Revenue</Text></View>
        </View>

        {/* ── filters ── */}
        <View style={styles.card}>

          {/* Bus */}
          <View style={styles.row}>
            <Ionicons name="car" size={16} color="#2e7d32" style={{marginHorizontal:12}}/>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={busId} onValueChange={setBusId} style={styles.picker}>
                <Picker.Item label="Select Bus" value={undefined}/>
                {buses.map(b=><Picker.Item key={b.id} label={b.identifier} value={b.id}/>)}
              </Picker>
            </View>
          </View>

          {/* Date */}
          <TouchableOpacity style={styles.row} onPress={()=>setShowDate(true)}>
            <Ionicons name="calendar" size={16} color="#2e7d32" style={{marginRight:12}}/>
            <Text style={styles.rowText}>{dayjs(date).format('MMMM D, YYYY')}</Text>
          </TouchableOpacity>

         {/* Trip */}
<View style={styles.row}>
  <Ionicons
    name="list"
    size={16}
    color="#2e7d32"
    style={{ marginHorizontal: 12 }}
  />
  <View style={styles.pickerWrap}>
    <Picker
      selectedValue={tripId}
      enabled={trips.length > 0}
      style={styles.picker}
      onValueChange={(value: number | undefined) => {
        setTripId(value);
        // once we've picked a trip, propagate its route_id
        const sel = trips.find(t => t.id === value);
        if (sel && sel.route_id != null) {
          setRouteId(sel.route_id);
        }
      }}
    >
      <Picker.Item label="Select Trip" value={undefined} />
      {trips.map(t => (
        <Picker.Item
          key={t.id}
          label={`${t.number} • ${t.start_time}–${t.end_time}`}
          value={t.id}
        />
      ))}
    </Picker>
  </View>
</View>


          {/* button */}
          <TouchableOpacity style={[styles.btn,{opacity:loading||!tripId?0.6:1}]}
                            disabled={loading||!tripId}
                            onPress={fetchInsights}>
            {loading?<ActivityIndicator color="#fff"/>:<Text style={styles.btnTxt}>Filter</Text>}
          </TouchableOpacity>
        </View>

        {/* timeline */}
        {timeline.length>0 && (
          <View style={styles.card}>
            <Text style={styles.tableTitle}>Timeline</Text>
            {timeline.map((r,i)=>(
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.cell,{flex:1}]}>{r.time}</Text>
                <Text style={[styles.cell,{flex:1}]}>{r.passengers}</Text>
                <Text style={[styles.cell,{flex:1}]}>{r.tickets}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showDate && (
        <DateTimePicker value={date} mode="date" display="calendar"
                        onChange={(_,d)=>{setShowDate(false); if(d) setDate(d);}}/>
      )}
    </View>
  );
}

/* ── styles (trimmed) ── */
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f0f8f0'},
  header:{flexDirection:'row',alignItems:'center',backgroundColor:'#2e7d32',
          paddingTop:Platform.OS==='ios'?50:30,paddingBottom:14,paddingHorizontal:16},
  backBtn:{padding:4}, headerTitle:{flex:1,textAlign:'center',fontSize:20,fontWeight:'700',color:'#fff'},

  kpiCard:{flexDirection:'row',margin:20,backgroundColor:'#fff',borderRadius:20,paddingVertical:20,elevation:3},
  kpiBox:{flex:1,alignItems:'center'},kpiVal:{fontSize:26,fontWeight:'700',color:'#2e7d32'},
  kpiLbl:{fontSize:12,color:'#6b7280',marginTop:4},divider:{width:1,backgroundColor:'#e5e7eb'},

  card:{marginHorizontal:20,marginBottom:20,backgroundColor:'#fff',borderRadius:20,padding:20,elevation:3},
  row:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#e5e7eb',
       borderRadius:12,paddingVertical:12,paddingHorizontal:16,marginBottom:12},
  rowText:{color:'#2e7d32',fontWeight:'600',flex:1},

  pickerWrap:{flex:1,height:48,justifyContent:'center'},
  picker:{flex:1,color:'#2e7d32'},

  btn:{backgroundColor:'#2e7d32',borderRadius:15,paddingVertical:14,alignItems:'center',marginTop:8},
  btnTxt:{color:'#fff',fontWeight:'700'},

  tableTitle:{fontSize:14,fontWeight:'700',color:'#2e7d32',marginBottom:12},
  tableRow:{flexDirection:'row',paddingVertical:6,borderBottomWidth:1,borderColor:'#f3f4f6'},
  cell:{fontSize:12,color:'#374151',textAlign:'center'},
});
