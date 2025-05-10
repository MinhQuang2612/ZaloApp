import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchGroupMembers, fetchUserGroups, GroupMember } from "../services/group";
import { addGroupMember, deleteGroup, kickMember, leaveGroup, leaderLeaveGroup, renameGroup } from "../services/socket";
import socket from "../services/socket";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { fetchContacts, Contact } from "../services/contacts";

type GroupMemberWithInfo = GroupMember & { avatar?: string; username: string };

type MemberItemProps = {
  member: GroupMemberWithInfo;
  currentUserID: string | null;
  isLeader: boolean;
  onKick: (userID: string) => void;
  onViewProfile: (userID: string) => void;
};

const MemberItem = ({ member, currentUserID, isLeader, onKick, onViewProfile }: MemberItemProps) => {
  return (
    <View style={styles.memberItem}>
      <TouchableOpacity style={styles.memberInfo} onPress={() => onViewProfile(member.userID)}>
        <Image
          source={{ uri: member.avatar || "https://randomuser.me/api/portraits/men/1.jpg" }}
          style={styles.memberAvatar}
          onError={(e) => console.log("Error loading avatar:", e.nativeEvent.error)}
        />
        <View>
          <Text style={styles.memberName}>{member.username}</Text>
          <Text style={styles.memberRole}>{member.memberRole}</Text>
        </View>
      </TouchableOpacity>
      {isLeader && member.userID !== currentUserID && (
        <TouchableOpacity onPress={() => onKick(member.userID)}>
          <Ionicons name="remove-circle-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function GroupDetail() {
  const { groupID } = useLocalSearchParams<{ groupID?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState<string>("Nhóm không tên");
  const [members, setMembers] = useState<GroupMemberWithInfo[]>([]);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [memberAvatars, setMemberAvatars] = useState<string[]>([]); // Lưu danh sách avatar của tối đa 4 thành viên
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingGroupName, setLoadingGroupName] = useState<boolean>(true);
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [newMemberID, setNewMemberID] = useState<string>("");
  const [showTransferLeaderModal, setShowTransferLeaderModal] = useState(false);
  const [selectedNewLeaderID, setSelectedNewLeaderID] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchContact, setSearchContact] = useState<string>("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [transferMode, setTransferMode] = useState<'leave' | 'manual'>('leave');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const fetchUserAvatarAndName = async (userID: string): Promise<{ avatar: string; username: string }> => {
    try {
      const response = await api.get(`/api/user/${userID}`);
      const userData = response.data;
      return {
        avatar: userData.avatar && userData.avatar.trim() !== "" ? userData.avatar : "https://randomuser.me/api/portraits/men/1.jpg",
        username: userData.username || userID,
      };
    } catch (error) {
      return {
        avatar: "https://randomuser.me/api/portraits/men/1.jpg",
        username: userID,
      };
    }
  };

  const fetchGroupDetails = async (userID: string, groupID: string) => {
    try {
      setLoadingGroupName(true);
      const userGroups = await fetchUserGroups(userID);
      const group = userGroups.find((g) => g.groupID === groupID);
      if (group) {
        setGroupName(group.groupName);
      } else {
        console.warn("Không tìm thấy nhóm với groupID:", groupID);
        setGroupName("Nhóm không tên");
      }

      const groupMembers = await fetchGroupMembers(groupID);
      setMembersCount(groupMembers.length || 0);

      // Lấy avatar và username song song cho tất cả member
      const infoPromises = groupMembers.map(member =>
        fetchUserAvatarAndName(member.userID)
          .then(info => info)
          .catch(() => ({ avatar: "https://randomuser.me/api/portraits/men/1.jpg", username: member.userID }))
      );
      const infoResults = await Promise.allSettled(infoPromises);
      const membersWithInfo = groupMembers.map((member, idx) => ({
        ...member,
        avatar:
          infoResults[idx].status === "fulfilled"
            ? infoResults[idx].value.avatar
            : "https://randomuser.me/api/portraits/men/1.jpg",
        username:
          infoResults[idx].status === "fulfilled"
            ? infoResults[idx].value.username
            : member.userID,
      }));
      setMembers(membersWithInfo);

      // Lấy avatar của tối đa 4 thành viên đầu tiên cho header
      const avatars: string[] = [];
      for (let i = 0; i < Math.min(4, membersWithInfo.length); i++) {
        avatars.push(membersWithInfo[i].avatar);
      }
      setMemberAvatars(avatars);

      const currentMember = groupMembers.find((member) => member.userID === userID);
      if (currentMember && currentMember.memberRole === "LEADER") {
        setIsLeader(true);
      } else {
        setIsLeader(false);
      }
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết nhóm:", error);
      Alert.alert("Lỗi", "Không thể tải chi tiết nhóm. Vui lòng thử lại.");
    } finally {
      setLoadingGroupName(false);
      setLoading(false);
    }
  };

  const fetchContactsList = async () => {
    if (!currentUserID) return;
    try {
      const res = await fetchContacts(currentUserID);
      setContacts(res || []);
    } catch (e) {
      setContacts([]);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberID.trim() || !groupID) {
      Alert.alert("Lỗi", "Vui lòng nhập userID của thành viên.");
      return;
    }

    try {
      const userCheckResponse = await fetch(`http://44.210.125.160:3000/api/user/${newMemberID}`);
      const userCheckData = await userCheckResponse.json();
      if (!userCheckData) {
        Alert.alert("Lỗi", "User không tồn tại.");
        return;
      }

      const response = await addGroupMember(newMemberID, groupID as string);
      Alert.alert("Thành công", response);
      setNewMemberID("");
      setShowAddMemberModal(false);
      await fetchGroupDetails(currentUserID!, groupID as string);
    } catch (error: any) {
      console.error("Lỗi khi thêm thành viên:", error.message);
      Alert.alert("Lỗi", `Không thể thêm thành viên: ${error.message}`);
    }
  };

  const handleKickMember = async (userID: string) => {
    if (!groupID || !currentUserID) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin nhóm hoặc người dùng.");
      return;
    }

    // Tìm username từ danh sách members
    const member = members.find(m => m.userID === userID);
    const displayName = member?.username || userID;

    Alert.alert(
      "Xác nhận",
      `Bạn có chắc chắn muốn kick thành viên ${displayName} khỏi nhóm không?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Kick",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await kickMember(currentUserID, userID, groupID as string);
              Alert.alert("Thành công", response);
              await fetchGroupDetails(currentUserID!, groupID as string);
            } catch (error: any) {
              console.error("Lỗi khi kick thành viên:", error.message);
              Alert.alert("Lỗi", `Không thể kick thành viên: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async () => {
    if (!groupID || !currentUserID || typeof groupID !== "string" || typeof currentUserID !== "string") {
      console.log("Dữ liệu không hợp lệ:", { groupID, currentUserID });
      Alert.alert("Lỗi", "Dữ liệu không hợp lệ.");
      return;
    }
  
    if (isLeader && members.length > 1) {
      console.log("Leader rời nhóm, mở modal chuyển quyền");
      setTransferMode('leave');
      setShowTransferLeaderModal(true);
      return;
    }
  
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn rời nhóm này không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Rời nhóm",
          style: "destructive",
          onPress: async () => {
            try {
              console.log(`Gửi leaveGroup: userID=${currentUserID}, groupID=${groupID}`);
              const response = await leaveGroup(currentUserID, groupID);
              console.log(`Phản hồi từ leaveGroup: ${response}`);
              Alert.alert("Thành công", "Đã rời nhóm thành công.");
              socket.emit("leaveGroupRoom", groupID);
              router.replace("/home");
            } catch (error: any) {
              console.error("Lỗi trong handleLeaveGroup:", error.message);
              Alert.alert("Lỗi", `Không thể rời nhóm: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  // Hàm xác nhận chuyển quyền và rời nhóm cho leader
  const handleTransferLeaderAndLeave = async () => {
    if (!selectedNewLeaderID) {
      console.log("Không có selectedNewLeaderID");
      Alert.alert("Lỗi", "Vui lòng chọn thành viên để chuyển quyền leader.");
      return;
    }
    try {
      console.log(`Gửi switchRole: currentUserID=${currentUserID}, selectedNewLeaderID=${selectedNewLeaderID}, groupID=${groupID}`);
      const response = await new Promise<string>((resolve, reject) => {
        socket.emit("switchRole", currentUserID, selectedNewLeaderID, groupID, (response: string) => {
          console.log(`Phản hồi từ switchRole: ${response}`);
          // Chấp nhận cả "Thành công" và "Thay đổi quyền LEADER thành công" là thành công
          if (response.includes("Thành công") || response === "Thay đổi quyền LEADER thành công") {
            resolve(response);
          } else {
            reject(new Error(response));
          }
        });
      });
      console.log(`switchRole thành công: ${response}`);
  
      if (transferMode === 'manual') {
        Alert.alert("Thành công", "Đã chuyển quyền trưởng nhóm.");
        setShowTransferLeaderModal(false);
        setSelectedNewLeaderID(null);
        await fetchGroupDetails(currentUserID!, groupID as string);
      } else {
        console.log(`Rời nhóm sau khi chuyển quyền: userID=${currentUserID}, groupID=${groupID}`);
        const leaveResponse = await leaveGroup(currentUserID!, groupID as string);
        Alert.alert("Thành công", leaveResponse);
        setShowTransferLeaderModal(false);
        setSelectedNewLeaderID(null);
        socket.emit("leaveGroupRoom", groupID);
        router.replace("/home");
      }
    } catch (error: any) {
      console.error("Lỗi trong handleTransferLeaderAndLeave:", error.message);
      // Chỉ hiển thị thông báo lỗi nếu không phải là phản hồi thành công
      if (error.message === "Thay đổi quyền LEADER thành công") {
        // Xử lý như trường hợp thành công
        if (transferMode === 'manual') {
          Alert.alert("Thành công", "Đã chuyển quyền trưởng nhóm.");
          setShowTransferLeaderModal(false);
          setSelectedNewLeaderID(null);
          await fetchGroupDetails(currentUserID!, groupID as string);
        } else {
          try {
            console.log(`Rời nhóm sau khi chuyển quyền: userID=${currentUserID}, groupID=${groupID}`);
            const leaveResponse = await leaveGroup(currentUserID!, groupID as string);
            Alert.alert("Thành công", leaveResponse);
            setShowTransferLeaderModal(false);
            setSelectedNewLeaderID(null);
            socket.emit("leaveGroupRoom", groupID);
            router.replace("/home");
          } catch (leaveError: any) {
            console.error("Lỗi khi rời nhóm:", leaveError.message);
            Alert.alert("Lỗi", `Không thể rời nhóm: ${leaveError.message}`);
          }
        }
      } else {
        Alert.alert("Lỗi", `Không thể chuyển quyền: ${error.message}`);
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupID || !currentUserID) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin nhóm hoặc người dùng.");
      return;
    }

    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn xóa nhóm này không? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await deleteGroup(currentUserID, groupID as string);
              Alert.alert("Thành công", response);
              router.replace("/home");
            } catch (error: any) {
              console.error("Lỗi khi xóa nhóm:", error.message);
              if (error.message !== "Xóa nhóm thành công") {
                Alert.alert("Lỗi", `Không thể xóa nhóm: ${error.message}`);
              }
            }
          },
        },
      ]
    );
  };

  const handleViewProfile = (userID: string) => {
    router.push({ pathname: "/user_profile", params: { userID } });
  };

  useEffect(() => {
    const initialize = async () => {
      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        console.error("Không tìm thấy user trong AsyncStorage");
        router.replace("/login");
        return;
      }

      const user = JSON.parse(userData);
      const userID = user.userID;
      if (!userID) {
        console.error("userID không hợp lệ:", userID);
        router.replace("/login");
        return;
      }
      setCurrentUserID(userID);

      if (!groupID) {
        console.error("groupID không hợp lệ:", groupID);
        return;
      }

      await fetchGroupDetails(userID, groupID as string);

      socket.emit("joinGroupRoom", groupID);
      console.log("GroupDetail.tsx: Joined group room:", groupID);

      socket.on("newMember", (userID: string) => {
        console.log("Thành viên mới tham gia nhóm:", userID);
        fetchGroupDetails(userID, groupID as string);
      });

      socket.on("groupDeleted", (deletedGroupID: string) => {
        console.log("Nhóm đã bị xóa:", deletedGroupID);
        if (deletedGroupID === groupID) {
          socket.emit("leaveGroupRoom", groupID);
          Alert.alert("Thông báo", "Nhóm đã bị xóa.");
          router.replace("/home");
        }
      });

      socket.on("memberKicked", ({ userID, groupID: kickedGroupID }: { userID: string; groupID: string }) => {
        console.log("Thành viên bị kick:", userID, "từ nhóm:", kickedGroupID);
        if (kickedGroupID === groupID) {
          if (userID === currentUserID) {
            socket.emit("leaveGroupRoom", groupID);
            Alert.alert("Thông báo", "Bạn đã bị kick khỏi nhóm.");
            router.replace("/home");
          } else {
            fetchGroupDetails(currentUserID!, groupID as string);
          }
        }
      });

      socket.on("memberLeft", ({ userID, groupID: leftGroupID }: { userID: string; groupID: string }) => {
        console.log("Thành viên rời nhóm:", userID, "từ nhóm:", leftGroupID);
        if (leftGroupID === groupID && userID !== currentUserID) {
          fetchGroupDetails(currentUserID!, groupID as string);
        }
      });

      // Lắng nghe sự kiện forceLeaveGroup để xử lý khi bị kick khỏi nhóm
      socket.on("forceLeaveGroup", (userID: string, forceGroupID: string) => {
        console.log("Nhận forceLeaveGroup:", userID, forceGroupID, "currentUserID:", currentUserID);
        if (userID === currentUserID && forceGroupID === groupID) {
          socket.emit("leaveGroupRoom", groupID);
          Alert.alert("Thông báo", "Bạn đã bị kick khỏi nhóm.");
          router.replace("/home");
        }
      });
    };

    initialize();

    return () => {
      socket.off("newMember");
      socket.off("groupDeleted");
      socket.off("memberKicked");
      socket.off("memberLeft");
      socket.off("forceLeaveGroup"); // cleanup forceLeaveGroup
    };
  }, [groupID]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Navbar */}
      <View style={[styles.navbar, { paddingTop: Platform.OS === "ios" ? insets.top : 10, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chatbubble-outline" size={27} color="white" marginLeft="20"/>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.groupNameContainer}
          onPress={() => router.push({ pathname: "/group_detail", params: { groupID } })}
        >
          <View style={styles.groupAvatarContainer}>
            {/* Hiển thị avatar theo dạng 2x2 */}
            <View style={styles.avatarWrapper}>
              {/* Hàng trên (avatar 0 và 1) */}
              <View style={styles.avatarRow}>
                {memberAvatars[0] && (
                  <Image
                    source={{ uri: memberAvatars[0] }}
                    style={[styles.groupAvatar, { zIndex: 4 }]}
                    onError={(e) => console.log("Error loading avatar 0:", e.nativeEvent.error)}
                  />
                )}
                {memberAvatars[1] && (
                  <Image
                    source={{ uri: memberAvatars[1] }}
                    style={[styles.groupAvatar, { marginLeft: -20, zIndex: 3 }]}
                    onError={(e) => console.log("Error loading avatar 1:", e.nativeEvent.error)}
                  />
                )}
              </View>
              {/* Hàng dưới (avatar 2 và 3) */}
              <View style={[styles.avatarRow, { marginTop: -20 }]}>
                {memberAvatars[2] && (
                  <Image
                    source={{ uri: memberAvatars[2] }}
                    style={[styles.groupAvatar, { zIndex: 2 }]}
                    onError={(e) => console.log("Error loading avatar 2:", e.nativeEvent.error)}
                  />
                )}
                {memberAvatars[3] && (
                  <Image
                    source={{ uri: memberAvatars[3] }}
                    style={[styles.groupAvatar, { marginLeft: -20, zIndex: 1 }]}
                    onError={(e) => console.log("Error loading avatar 3:", e.nativeEvent.error)}
                  />
                )}
              </View>
            </View>
          </View>
          <View style={styles.groupInfo}>
            {loadingGroupName ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.groupName}>{groupName}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowRenameModal(true);
                      setNewGroupName(groupName);
                    }}
                    style={{ marginLeft: 6 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.groupDetails}>
                  <Ionicons name="people-outline" size={16} color="#fff" style={styles.groupDetailIcon} />
                  <Text style={styles.groupDetailText}>{membersCount} thành viên</Text>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Members Section */}
      <TouchableOpacity style={styles.section} onPress={() => setShowMembersModal(true)}>
        <Text style={styles.sectionTitle}>Thành viên nhóm</Text>
        <View style={styles.sectionContent}>
          <Ionicons name="people-outline" size={24} color="#007AFF" style={styles.sectionIcon} />
          <Text style={styles.sectionText}>{members.length} thành viên</Text>
          <Ionicons name="chevron-down" size={24} color="#666" style={styles.sectionArrow} />
        </View>
      </TouchableOpacity>

      {/* Group Board Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bảng tin nhóm</Text>
        <TouchableOpacity style={styles.sectionContent}>
          <Ionicons name="alarm-outline" size={24} color="#007AFF" style={styles.sectionIcon} />
          <Text style={styles.sectionText}>Danh sách nhắc hẹn</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sectionContent}>
          <Ionicons name="document-text-outline" size={24} color="#007AFF" style={styles.sectionIcon} />
          <Text style={styles.sectionText}>Ghi chú, ghim, bình chọn</Text>
        </TouchableOpacity>
      </View>

      {/* Leave/Delete Group Buttons */}
      <View style={styles.footerButtons}>
        {/* Nút Thêm thành viên: chỉ leader mới thấy */}
        {isLeader && (
          <TouchableOpacity style={styles.actionButton} onPress={() => {
            setShowAddMemberModal(true);
            fetchContactsList();
          }}>
            <Ionicons name="person-add-outline" size={24} color="#666" />
            <Text style={styles.actionText}>Thêm thành viên</Text>
          </TouchableOpacity>
        )}
        {/* Nút chuyển quyền trưởng nhóm: leader và nhóm >1 thành viên */}
        {isLeader && members.length > 1 && (
          <TouchableOpacity style={styles.actionButton} onPress={() => {
            setTransferMode('manual');
            setShowTransferLeaderModal(true);
          }}>
            <Ionicons name="swap-horizontal-outline" size={24} color="#666" />
            <Text style={styles.actionText}>Chuyển quyền trưởng nhóm</Text>
          </TouchableOpacity>
        )}
        {/* Các nút rời nhóm, xóa nhóm giữ nguyên vị trí sau */}
        {!isLeader && (
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
            <Text style={styles.leaveButtonText}>Rời nhóm</Text>
          </TouchableOpacity>
        )}
        {isLeader && (
          <View style={styles.leaderButtonRow}>
            {members.length > 1 && (
              <TouchableOpacity style={[styles.leaveButton, styles.leaderButton]} onPress={handleLeaveGroup}>
                <Text style={styles.leaveButtonText}>Rời nhóm</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.deleteButton, styles.leaderButton, members.length > 1 && { marginLeft: 12 }]} onPress={handleDeleteGroup}>
              <Text style={styles.deleteButtonText}>Xóa nhóm</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.membersModal}>
            <Text style={styles.modalTitle}>Danh sách thành viên</Text>
            <FlatList
              data={members}
              keyExtractor={(item) => item.userID}
              renderItem={({ item }) => (
                <MemberItem
                  member={item}
                  currentUserID={currentUserID}
                  isLeader={isLeader}
                  onKick={handleKickMember}
                  onViewProfile={handleViewProfile}
                />
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMembersModal(false)}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.addMemberModal}>
            <Text style={styles.modalTitle}>Chọn bạn bè để thêm vào nhóm</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tìm kiếm theo tên"
              value={searchContact}
              onChangeText={setSearchContact}
            />
            <FlatList
              data={contacts.filter(c =>
                c.username.toLowerCase().includes(searchContact.toLowerCase()) &&
                !members.some(m => m.userID === c.userID)
              )}
              keyExtractor={item => item.userID}
              renderItem={({ item }) => {
                const checked = selectedContacts.includes(item.userID);
                return (
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
                    onPress={() => {
                      setSelectedContacts(prev =>
                        prev.includes(item.userID)
                          ? prev.filter(id => id !== item.userID)
                          : [...prev, item.userID]
                      );
                    }}
                  >
                    <Image source={{ uri: item.avatar }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                    <Text style={{ fontSize: 16, flex: 1 }}>{item.username}</Text>
                    {checked && <Ionicons name="checkmark-circle" size={22} color="#007AFF" />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 250 }}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowAddMemberModal(false);
                  setSearchContact("");
                  setSelectedContacts([]);
                }}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { opacity: selectedContacts.length === 0 ? 0.5 : 1 }]}
                disabled={selectedContacts.length === 0}
                onPress={async () => {
                  try {
                    await Promise.all(selectedContacts.map(uid => addGroupMember(uid, groupID as string)));
                    Alert.alert("Thành công", "Đã thêm thành viên vào nhóm");
                    setShowAddMemberModal(false);
                    setSearchContact("");
                    setSelectedContacts([]);
                    await fetchGroupDetails(currentUserID!, groupID as string);
                  } catch (error: any) {
                    Alert.alert("Lỗi", `Không thể thêm thành viên: ${error.message}`);
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal chọn thành viên để chuyển quyền leader */}
      <Modal
        visible={showTransferLeaderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTransferLeaderModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.addMemberModal}>
            <Text style={styles.modalTitle}>
              {transferMode === 'manual' ? 'Chọn thành viên để chuyển quyền leader' : 'Chọn thành viên để chuyển quyền trước khi rời nhóm'}
            </Text>
            <FlatList
              data={members.filter(m => m.userID !== currentUserID)}
              keyExtractor={item => item.userID}
              renderItem={({ item }: { item: GroupMemberWithInfo }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 10,
                    backgroundColor: selectedNewLeaderID === item.userID ? "#e0e0e0" : "#fff",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  onPress={() => setSelectedNewLeaderID(item.userID)}
                >
                  <Image source={{ uri: item.avatar }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                  <Text style={{ fontSize: 16 }}>{item.username}</Text>
                  {selectedNewLeaderID === item.userID && (
                    <Ionicons name="checkmark-circle" size={20} color="#007AFF" style={{ marginLeft: 10 }} />
                  )}
                </TouchableOpacity>
              )}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowTransferLeaderModal(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleTransferLeaderAndLeave}>
                <Text style={styles.modalButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal đổi tên nhóm */}
      <Modal
        visible={showRenameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.addMemberModal}>
            <Text style={styles.modalTitle}>Đổi tên nhóm</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nhập tên nhóm mới"
              value={newGroupName}
              onChangeText={setNewGroupName}
              editable={!renaming}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowRenameModal(false)}
                disabled={renaming}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { opacity: !newGroupName.trim() || renaming ? 0.5 : 1 }]}
                disabled={!newGroupName.trim() || renaming}
                onPress={async () => {
                  if (!newGroupName.trim()) return;
                  setRenaming(true);
                  try {
                    await renameGroup(groupID as string, newGroupName.trim());
                    setGroupName(newGroupName.trim());
                    setShowRenameModal(false);
                    Alert.alert("Thành công", "Đã đổi tên nhóm thành công");
                  } catch (error: any) {
                    Alert.alert("Lỗi", error.message || "Không thể đổi tên nhóm");
                  } finally {
                    setRenaming(false);
                  }
                }}
              >
                {renaming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Đổi tên</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
  },
  groupNameContainer: {
    flex: 1,
    alignItems: "center", // Căn giữa avatar và thông tin nhóm
    marginLeft: 10,
  },
  groupAvatarContainer: {
    flexDirection: "column", // Đặt avatar và thông tin nhóm theo cột
    alignItems: "center",
    position: "relative",
  },
  avatarWrapper: {
    width: 80, // Tăng kích thước để chứa avatar lớn hơn
    height: 80, // Tăng kích thước để chứa 2 hàng avatar
    position: "relative",
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  groupAvatar: {
    width: 48, // Tăng kích thước avatar từ 36px lên 48px
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#fff",
  },
  groupInfo: {
    marginTop: 5, // Khoảng cách giữa avatar và thông tin nhóm
    justifyContent: "center",
    alignItems: "center",
  },
  groupName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  groupDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  groupDetailIcon: {
    marginRight: 5,
  },
  groupDetailText: {
    color: "#fff",
    fontSize: 14,
  },
  section: { padding: 15, backgroundColor: "#fff", marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  sectionContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  sectionIcon: { marginRight: 10 },
  sectionText: { fontSize: 14, color: "#000", flex: 1 },
  sectionArrow: { marginLeft: 10 },
  footerButtons: { padding: 15, backgroundColor: "#fff", marginTop: 10 },
  actionButton: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  actionText: { fontSize: 14, color: "#666", marginLeft: 10 },
  leaveButton: {
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  leaveButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  deleteButton: {
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalContainer: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  membersModal: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 20,
    maxHeight: "80%",
  },
  addMemberModal: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  modalButtonContainer: { flexDirection: "row", justifyContent: "space-around" },
  modalButton: { backgroundColor: "#007AFF", padding: 10, borderRadius: 10, width: 100, alignItems: "center" },
  modalButtonText: { color: "#fff", fontSize: 16 },
  closeButton: { backgroundColor: "#007AFF", padding: 10, borderRadius: 10, alignItems: "center", marginTop: 10 },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  memberInfo: { flexDirection: "row", alignItems: "center" },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  memberName: { fontSize: 16, fontWeight: "bold" },
  memberRole: { fontSize: 14, color: "#666" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  leaderButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
  },
  leaderButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: 15,
  },
});