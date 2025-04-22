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
import { addGroupMember, deleteGroup, kickMember, leaveGroup } from "../services/socket";
import socket from "../services/socket";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MemberItemProps = {
  member: GroupMember;
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
          source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }}
          style={styles.memberAvatar}
          onError={(e) => console.log("Error loading avatar:", e.nativeEvent.error)}
        />
        <View>
          <Text style={styles.memberName}>{member.userID}</Text>
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
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [memberAvatars, setMemberAvatars] = useState<string[]>([]); // Lưu danh sách avatar của tối đa 4 thành viên
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingGroupName, setLoadingGroupName] = useState<boolean>(true);
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [newMemberID, setNewMemberID] = useState<string>("");

  const fetchUserAvatar = async (userID: string): Promise<string> => {
    try {
      const response = await fetch(`http://3.95.192.17:3000/api/user/${userID}`);
      const userData = await response.json();
      return userData.avatar || "https://randomuser.me/api/portraits/men/1.jpg"; // Ảnh mặc định nếu không có avatar
    } catch (error) {
      console.error(`Lỗi khi lấy avatar của user ${userID}:`, error);
      return "https://randomuser.me/api/portraits/men/1.jpg"; // Ảnh mặc định nếu lỗi
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
      setMembers(groupMembers);
      setMembersCount(groupMembers.length || 0);

      // Lấy avatar của tối đa 4 thành viên đầu tiên
      const avatars: string[] = [];
      for (let i = 0; i < Math.min(4, groupMembers.length); i++) {
        const member = groupMembers[i];
        const avatar = await fetchUserAvatar(member.userID);
        avatars.push(avatar);
      }
      setMemberAvatars(avatars);

      const currentMember = groupMembers.find((member) => member.userID === userID);
      if (currentMember && currentMember.memberRole === "LEADER") {
        setIsLeader(true);
      }
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết nhóm:", error);
      Alert.alert("Lỗi", "Không thể tải chi tiết nhóm. Vui lòng thử lại.");
    } finally {
      setLoadingGroupName(false);
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberID.trim() || !groupID) {
      Alert.alert("Lỗi", "Vui lòng nhập userID của thành viên.");
      return;
    }

    try {
      const userCheckResponse = await fetch(`http://3.95.192.17:3000/api/user/${newMemberID}`);
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

    Alert.alert(
      "Xác nhận",
      `Bạn có chắc chắn muốn kick thành viên ${userID} khỏi nhóm không?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Kick",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await kickMember(userID, groupID as string);
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
    if (!groupID || !currentUserID) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin nhóm hoặc người dùng.");
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
              const response = await leaveGroup(currentUserID, groupID as string);
              Alert.alert("Thành công", response);
              socket.emit("leaveGroupRoom", groupID);
              router.replace("/home");
            } catch (error: any) {
              console.error("Lỗi khi rời nhóm:", error.message);
              Alert.alert("Lỗi", `Không thể rời nhóm: ${error.message}`);
            }
          },
        },
      ]
    );
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
    };

    initialize();

    return () => {
      socket.off("newMember");
      socket.off("groupDeleted");
      socket.off("memberKicked");
      socket.off("memberLeft");
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
                <Text style={styles.groupName}>{groupName}</Text>
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
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowAddMemberModal(true)}>
          <Ionicons name="person-add-outline" size={24} color="#666" />
          <Text style={styles.actionText}>Thêm thành viên</Text>
        </TouchableOpacity>
        {!isLeader && (
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
            <Text style={styles.leaveButtonText}>Rời nhóm</Text>
          </TouchableOpacity>
        )}
        {isLeader && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
            <Text style={styles.deleteButtonText}>Xóa nhóm</Text>
          </TouchableOpacity>
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
            <Text style={styles.modalTitle}>Thêm thành viên mới</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nhập userID của thành viên"
              value={newMemberID}
              onChangeText={setNewMemberID}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowAddMemberModal(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleAddMember}>
                <Text style={styles.modalButtonText}>Thêm</Text>
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
});